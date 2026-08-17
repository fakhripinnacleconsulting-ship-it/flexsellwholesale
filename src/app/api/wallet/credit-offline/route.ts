import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { requireWalletAdmin, verifyAdminPassword } from "@/lib/walletGuard";
import { parseAmountToPaise, toRupees, formatPaise } from "@/lib/money";
import {
  writeLedgerEntry,
  isDuplicateKeyError,
  findExistingByIdempotencyKey,
  InsufficientBalanceError,
  WalletNotActiveError,
} from "@/lib/walletLedger";
import { runInTransaction } from "@/lib/transactionHelper";
import {
  WALLET_TYPES,
  BUSINESS_WALLET_TIERS,
  ADMIN_REAUTH_THRESHOLD_PAISE,
} from "@/lib/walletConstants";
import type { WalletTransactionSource } from "@/types/wallet";

export const dynamic = "force-dynamic";

const OFFLINE_SOURCES = ["cash", "bank_transfer", "upi", "cheque"] as const;
type OfflineSource = (typeof OFFLINE_SOURCES)[number];

const SOURCE_LABEL: Record<OfflineSource, string> = {
  cash: "Cash Received",
  bank_transfer: "Bank Transfer Received",
  upi: "UPI Received",
  cheque: "Cheque Received",
};

/**
 * Credits a wallet for money received outside the payment gateway.
 *
 * **This is the only endpoint in the system that creates spendable balance with nothing
 * external confirming it.** Everywhere else Razorpay has already verified that money
 * moved; here an admin asserts it. Every control below exists because of that asymmetry,
 * and none of them should be relaxed for convenience:
 *
 *  - admin only, never a manager and never a grantable permission
 *  - proof of payment is mandatory, not optional
 *  - a reference is required for anything with one (UTR, cheque number)
 *  - the acting admin's id, name and IP are recorded immutably on the entry
 *  - the customer is always notified, because their noticing an unexpected credit is a
 *    genuine fraud control
 *  - a cheque lands as `pending`, so a bounced cheque leaves no spendable balance behind
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    const body = await request.json();
    const {
      userId,
      walletType,
      source,
      referenceId,
      description,
      proofUrl,
      clientRequestId,
      adminPassword,
    } = body;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ message: "Customer is required" }, { status: 400 });
    }
    if (!WALLET_TYPES.includes(walletType)) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }
    if (!OFFLINE_SOURCES.includes(source)) {
      return NextResponse.json({ message: "Unknown payment source" }, { status: 400 });
    }
    if (!clientRequestId || typeof clientRequestId !== "string") {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 });
    }

    // Mandatory, not "recommended". A cash credit with no slip behind it is unauditable,
    // and the audit trail is the entire substitute for a gateway here.
    if (!proofUrl || typeof proofUrl !== "string") {
      return NextResponse.json(
        { message: "Upload proof of payment (receipt, slip or screenshot) before adding funds" },
        { status: 400 }
      );
    }

    // Bank, UPI and cheque all carry a number that can be checked against a statement.
    // Cash does not, so it needs a written note instead — something must be reviewable.
    if (source === "cash") {
      if (!description || String(description).trim().length < 3) {
        return NextResponse.json(
          { message: "Add a note describing how this cash was received" },
          { status: 400 }
        );
      }
    } else if (!referenceId || String(referenceId).trim().length === 0) {
      return NextResponse.json(
        { message: "A reference number (UTR / cheque number) is required for this source" },
        { status: 400 }
      );
    }

    let amountPaise: number;
    try {
      amountPaise = parseAmountToPaise(body.amount, { label: "Amount" });
    } catch (err) {
      return NextResponse.json({ message: (err as Error).message }, { status: 400 });
    }

    if (amountPaise >= ADMIN_REAUTH_THRESHOLD_PAISE) {
      const check = await verifyAdminPassword(payload.userId, adminPassword);
      if (!check.ok) return check.error;
    }

    await dbConnect();

    const customer = await Customer.findById(userId)
      .select("name email role customerTypes")
      .lean() as { name?: string; email?: string; role?: string; customerTypes?: string[] } | null;

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }
    if (customer.role === "admin") {
      return NextResponse.json({ message: "Staff accounts do not hold wallets" }, { status: 400 });
    }
    if (walletType === "business") {
      const eligible = (customer.customerTypes || []).some((t) =>
        (BUSINESS_WALLET_TIERS as readonly string[]).includes(t)
      );
      if (!eligible) {
        return NextResponse.json(
          { message: "This customer is not eligible for a Business Wallet" },
          { status: 400 }
        );
      }
    }

    /**
     * A cheque is money *promised*, not money received. Crediting it as spendable would
     * mean a bounced cheque leaves real balance behind, which the customer may already have
     * spent. It lands as pending and an admin confirms it after clearing.
     */
    const status = source === "cheque" ? ("pending" as const) : ("success" as const);

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    try {
      const { transaction, wallet } = await runInTransaction((session) =>
        writeLedgerEntry({
          userId,
          walletType,
          type: "CREDIT",
          source: source as WalletTransactionSource,
          amountPaise,
          transactionName: SOURCE_LABEL[source as OfflineSource],
          actor,
          description: description ? String(description).trim() : undefined,
          referenceId: referenceId ? String(referenceId).trim() : undefined,
          proofUrl,
          clientRequestId,
          status,
          metadata: {
            offlineCredit: true,
            recordedByIp: ip,
            recordedAt: new Date(),
          },
          session,
        })
      );

      // After the commit, never inside it — a failed notification must not roll back a
      // credit the customer's money has already paid for.
      void notifyCustomer({
        userId,
        email: customer.email,
        name: customer.name,
        amountPaise,
        walletType,
        source: source as OfflineSource,
        pending: status === "pending",
      });

      return NextResponse.json(
        {
          message:
            status === "pending"
              ? "Cheque recorded. Confirm it after clearing to make the balance spendable."
              : "Funds added",
          transactionId: String(transaction._id),
          receiptNumber: transaction.receiptNumber,
          balance: toRupees(wallet.availableBalance),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (err) {
      // A repeated clientRequestId means the admin's browser resent the same intent. The
      // work already happened; returning the original entry is both correct and calmer
      // than an error that invites them to try again.
      if (isDuplicateKeyError(err)) {
        const existing = await findExistingByIdempotencyKey({ clientRequestId });
        return NextResponse.json(
          {
            message: "Funds already added",
            transactionId: existing ? String((existing as { _id: unknown })._id) : undefined,
            duplicate: true,
          },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
      if (err instanceof InsufficientBalanceError || err instanceof WalletNotActiveError) {
        return NextResponse.json({ message: err.message }, { status: err.status });
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("[Wallet] Offline credit failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to add funds" },
      { status: 500 }
    );
  }
}

async function notifyCustomer(params: {
  userId: string;
  email?: string;
  name?: string;
  amountPaise: number;
  walletType: string;
  source: OfflineSource;
  pending: boolean;
}) {
  try {
    const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
    const walletLabel = params.walletType === "business" ? "Business Wallet" : "Store Wallet";

    dispatchEventServer({
      eventType: "WALLET_CREDITED",
      category: "payments",
      actor: { id: "SYSTEM", name: "FlexSell Wholesale", role: "system" },
      recipient: {
        customerId: params.userId,
        email: params.email || "",
        name: params.name || "Valued Customer",
        role: "both",
      },
      entity: { type: "wallet", id: params.userId },
      data: {
        amount: toRupees(params.amountPaise),
        walletType: params.walletType,
        message: params.pending
          ? `${formatPaise(params.amountPaise)} received by ${SOURCE_LABEL[params.source].toLowerCase()} has been recorded against your ${walletLabel}. It becomes available once cleared.`
          : `${formatPaise(params.amountPaise)} received by ${SOURCE_LABEL[params.source].toLowerCase()} has been added to your ${walletLabel}.`,
      },
    });
  } catch (err) {
    console.error("[Wallet] Failed to notify customer of offline credit:", err);
  }
}
