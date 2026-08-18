import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTransaction from "@/models/WalletTransaction";
import Customer from "@/models/Customer";
import { requireWalletAdmin, verifyAdminPassword } from "@/lib/walletGuard";
import { rateLimit } from "@/lib/rateLimit";
import { parseAmountToPaise, toRupees } from "@/lib/money";
import { runInTransaction } from "@/lib/transactionHelper";
import { getOrCreateWallet, nextReceiptNumber, InsufficientBalanceError } from "@/lib/walletLedger";
import { ADMIN_REAUTH_THRESHOLD_PAISE, BUSINESS_WALLET_TIERS } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

/**
 * Moves money from a customer's Store Wallet to their Business Wallet.
 *
 * **One direction only.** The endpoint takes an amount and nothing else — there is no
 * `from`/`to` pair that could be sent backwards, because the direction is the rule rather
 * than a parameter.
 *
 * Business Wallet money is services-only and non-refundable. If it could flow back into the
 * Store Wallet it would become spendable on goods and effectively recoverable, which would
 * quietly undo both restrictions. Reversing a mistaken transfer is an admin correction
 * (`REVERSAL`), not a supported direction of travel.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    // Every wallet write is rate limited per actor. Only recharge/initiate had one, so the
    // rest were bounded by nothing but how fast a script could post.
    try {
      await rateLimit(payload.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { userId, amount, reason, adminPassword } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ message: "Customer is required" }, { status: 400 });
    }

    let amountPaise: number;
    try {
      amountPaise = parseAmountToPaise(amount, { label: "Transfer amount" });
    } catch (err) {
      return NextResponse.json({ message: (err as Error).message }, { status: 400 });
    }

    if (amountPaise >= ADMIN_REAUTH_THRESHOLD_PAISE) {
      const check = await verifyAdminPassword(payload.userId, adminPassword);
      if (!check.ok) return check.error;
    }

    await dbConnect();

    const customer = await Customer.findById(userId).select("role customerTypes").lean() as
      | { role?: string; customerTypes?: string[] }
      | null;

    if (!customer) return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    if (customer.role === "admin") {
      return NextResponse.json({ message: "Staff accounts do not hold wallets" }, { status: 400 });
    }

    const eligible = (customer.customerTypes || []).some((t) =>
      (BUSINESS_WALLET_TIERS as readonly string[]).includes(t)
    );
    if (!eligible) {
      return NextResponse.json(
        { message: "This customer is not eligible for a Business Wallet" },
        { status: 400 }
      );
    }

    const result = await runInTransaction(async (session) => {
      const store = await getOrCreateWallet(userId, "store", session);
      const business = await getOrCreateWallet(userId, "business", session);
      if (!store || !business) throw new Error("Wallets could not be resolved");

      if (store.status !== "active" || business.status !== "active") {
        throw new Error("Both wallets must be active to transfer between them.");
      }

      const debited = await Wallet.findOneAndUpdate(
        { _id: store._id, status: "active", availableBalance: { $gte: amountPaise } },
        { $inc: { availableBalance: -amountPaise, totalDebited: amountPaise } },
        { new: true, session }
      );
      if (!debited) throw new InsufficientBalanceError("store");

      const credited = await Wallet.findOneAndUpdate(
        { _id: business._id, status: "active" },
        { $inc: { availableBalance: amountPaise, totalCredited: amountPaise } },
        { new: true, session }
      );
      if (!credited) throw new Error("Business Wallet is not active");

      const [outReceipt, inReceipt] = await Promise.all([
        nextReceiptNumber("debit"),
        nextReceiptNumber("credit"),
      ]);

      // Both entries or neither. A transfer that half-commits is the worst possible ledger
      // state: the money exists in no wallet and the customer cannot see where it went.
      const [outEntry] = await WalletTransaction.create(
        [
          {
            walletId: String(store._id),
            userId,
            walletType: "store",
            type: "TRANSFER_OUT",
            source: "transfer",
            transactionName: "Transfer to Business Wallet",
            description: reason || undefined,
            amount: amountPaise,
            balanceBefore: debited.availableBalance + amountPaise,
            balanceAfter: debited.availableBalance,
            receiptNumber: outReceipt,
            status: "success",
            createdBy: actor,
          },
        ],
        { session, ordered: true }
      );

      const [inEntry] = await WalletTransaction.create(
        [
          {
            walletId: String(business._id),
            userId,
            walletType: "business",
            type: "TRANSFER_IN",
            source: "transfer",
            transactionName: "Transfer from Store Wallet",
            description: reason || undefined,
            amount: amountPaise,
            balanceBefore: credited.availableBalance - amountPaise,
            balanceAfter: credited.availableBalance,
            receiptNumber: inReceipt,
            counterpartTxnId: String(outEntry._id),
            status: "success",
            createdBy: actor,
          },
        ],
        { session, ordered: true }
      );

      await WalletTransaction.updateOne(
        { _id: outEntry._id },
        { $set: { counterpartTxnId: String(inEntry._id) } },
        { session }
      );

      return {
        storeBalance: debited.availableBalance,
        businessBalance: credited.availableBalance,
      };
    });

    return NextResponse.json(
      {
        message: "Transferred to the Business Wallet",
        storeBalance: toRupees(result.storeBalance),
        businessBalance: toRupees(result.businessBalance),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[Wallet] Transfer failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Transfer failed" },
      { status: 500 }
    );
  }
}
