import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTransaction from "@/models/WalletTransaction";
import { requireWalletAdmin, verifyAdminPassword } from "@/lib/walletGuard";
import { rateLimit } from "@/lib/rateLimit";
import { toRupees } from "@/lib/money";
import { runInTransaction } from "@/lib/transactionHelper";
import { nextReceiptNumber, isCreditType } from "@/lib/walletLedger";
import { ADMIN_REAUTH_THRESHOLD_PAISE } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

/**
 * Reverses a wallet entry.
 *
 * The **only** way to undo anything in this ledger. Entries are never edited or deleted, so
 * a wrong debit is corrected by adding an opposing entry that references the original —
 * both remain visible in the customer's passbook, which is what makes the history
 * replayable and a correction distinguishable from a cover-up.
 *
 * Admin-only, with password re-verification above the threshold: this route can create
 * balance out of nothing when reversing a debit.
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

    const { transactionId, reason, adminPassword } = await request.json();

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json({ message: "Transaction is required" }, { status: 400 });
    }
    // A reversal permanently alters someone's balance and their statement. Requiring the
    // reason makes an unexplained correction impossible rather than merely discouraged.
    if (!reason || String(reason).trim().length < 5) {
      return NextResponse.json(
        { message: "Give a reason for this reversal — it appears on the customer's statement" },
        { status: 400 }
      );
    }

    await dbConnect();

    const original = await WalletTransaction.findById(transactionId).lean() as
      | {
          _id: string;
          walletId: string;
          userId: string;
          walletType: "store" | "business";
          type: string;
          amount: number;
          transactionName: string;
          status: string;
        }
      | null;

    if (!original) return NextResponse.json({ message: "Transaction not found" }, { status: 404 });

    if (original.status !== "success") {
      return NextResponse.json(
        { message: `Only completed transactions can be reversed. This one is ${original.status}.` },
        { status: 409 }
      );
    }

    if (original.amount >= ADMIN_REAUTH_THRESHOLD_PAISE) {
      const check = await verifyAdminPassword(payload.userId, adminPassword);
      if (!check.ok) return check.error;
    }

    const originalWasCredit = isCreditType(original.type as never);

    const result = await runInTransaction(async (session) => {
      // Claiming the original is the idempotency guard: a second reversal request finds it
      // already `reversed` and stops, so a double-click cannot refund twice.
      const claimed = await WalletTransaction.findOneAndUpdate(
        { _id: original._id, status: "success" },
        { $set: { status: "reversed" } },
        { new: true, session }
      );
      if (!claimed) return null;

      /**
       * Reversing a credit takes money back out, so it must respect the balance the same
       * way a debit does — the customer may already have spent it. Reversing a debit simply
       * returns money and cannot fail on balance.
       */
      const wallet = originalWasCredit
        ? await Wallet.findOneAndUpdate(
            { _id: original.walletId, availableBalance: { $gte: original.amount } },
            { $inc: { availableBalance: -original.amount, totalCredited: -original.amount } },
            { new: true, session }
          )
        : await Wallet.findOneAndUpdate(
            { _id: original.walletId },
            { $inc: { availableBalance: original.amount, totalDebited: -original.amount } },
            { new: true, session }
          );

      if (!wallet) {
        // Not enough balance to claw a credit back. Throwing rolls the claim back so the
        // original stays `success` — marking it reversed without moving money would leave
        // the ledger disagreeing with the balance, which is exactly what reconciliation
        // exists to catch.
        throw new Error(
          "This credit cannot be reversed — the customer has already spent part of it. Record an adjustment instead."
        );
      }

      const receiptNumber = await nextReceiptNumber(originalWasCredit ? "debit" : "credit");

      const [reversal] = await WalletTransaction.create(
        [
          {
            walletId: original.walletId,
            userId: original.userId,
            walletType: original.walletType,
            type: "REVERSAL",
            source: "system",
            transactionName: `Reversal — ${original.transactionName}`,
            description: String(reason).trim(),
            amount: original.amount,
            balanceBefore: originalWasCredit
              ? wallet.availableBalance + original.amount
              : wallet.availableBalance - original.amount,
            balanceAfter: wallet.availableBalance,
            receiptNumber,
            reversalOf: String(original._id),
            status: "success",
            createdBy: actor,
          },
        ],
        { session, ordered: true }
      );

      return { reversalId: String(reversal._id), balancePaise: wallet.availableBalance };
    });

    if (!result) {
      return NextResponse.json({ message: "This transaction has already been reversed" }, { status: 409 });
    }

    return NextResponse.json(
      {
        message: "Transaction reversed",
        reversalId: result.reversalId,
        balance: toRupees(result.balancePaise),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Reversal failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Reversal failed" },
      { status: 500 }
    );
  }
}
