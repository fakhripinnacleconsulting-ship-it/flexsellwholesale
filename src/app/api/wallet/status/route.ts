import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import { requireWalletAdmin, verifyAdminPassword } from "@/lib/walletGuard";
import { toRupees, formatPaise } from "@/lib/money";
import { WALLET_TYPES } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

const ALLOWED = ["active", "frozen", "closed"] as const;
type WalletStatus = (typeof ALLOWED)[number];

/**
 * Freezes, unfreezes or closes a wallet.
 *
 * Freezing blocks debits and credits while leaving the passbook readable — the atomic
 * update in every write path filters on `status: "active"`, so this one field is the whole
 * mechanism.
 *
 * Closing **retains the history**. A closed wallet's statement must still open months later;
 * deleting it would remove the customer's record of money they actually spent.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    const { userId, walletType, status, reason, adminPassword } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ message: "Customer is required" }, { status: 400 });
    }
    if (!WALLET_TYPES.includes(walletType)) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ message: "Unknown status" }, { status: 400 });
    }

    const nextStatus = status as WalletStatus;

    /**
     * The reason is mandatory, and required as a *field* rather than encouraged.
     *
     * Closure with a leftover balance is an admin judgement made case by case. A
     * case-by-case policy with no recorded rationale is indistinguishable from an arbitrary
     * one when it is questioned six months later.
     */
    if (nextStatus !== "active" && (!reason || String(reason).trim().length < 5)) {
      return NextResponse.json(
        { message: `Give a reason for ${nextStatus === "closed" ? "closing" : "freezing"} this wallet` },
        { status: 400 }
      );
    }

    await dbConnect();

    const wallet = await Wallet.findOne({ userId, type: walletType });
    if (!wallet) return NextResponse.json({ message: "Wallet not found" }, { status: 404 });

    if (wallet.status === nextStatus) {
      return NextResponse.json({ message: `This wallet is already ${nextStatus}` }, { status: 409 });
    }

    // Closing a wallet that still holds money is the decision worth pausing on, so it asks
    // for the password regardless of amount.
    if (nextStatus === "closed" && wallet.availableBalance > 0) {
      const check = await verifyAdminPassword(payload.userId, adminPassword);
      if (!check.ok) return check.error;
    }

    if (nextStatus === "closed" && wallet.heldBalance > 0) {
      return NextResponse.json(
        {
          message:
            "This wallet has money held for an order in progress. Wait for that order to settle before closing.",
        },
        { status: 409 }
      );
    }

    const previousStatus = wallet.status;
    wallet.status = nextStatus;
    if (nextStatus === "closed") wallet.closureReason = String(reason).trim();
    await wallet.save();

    /**
     * A status change is recorded on the wallet, deliberately **not** in the ledger.
     *
     * It moves no money, and the transaction collection is what reconciliation sums. An
     * entry there would need an amount, and any non-zero amount — even a one-paise marker —
     * would show up as drift on the very report that exists to prove the ledger and the
     * balance agree.
     *
     * The customer still sees the state: the wallet card renders a status badge and the
     * closure reason, so a frozen wallet explains itself rather than looking broken.
     */
    console.warn(
      `[Wallet] ${walletType} wallet for ${userId}: ${previousStatus} -> ${nextStatus} by ` +
        `${actor.name} (${actor.role}). Reason: ${reason ? String(reason).trim() : "n/a"}. ` +
        `Balance at change: ${formatPaise(wallet.availableBalance)}`
    );

    void notifyStatusChange({
      userId,
      walletType,
      status: nextStatus,
      reason: reason ? String(reason).trim() : undefined,
      balancePaise: wallet.availableBalance,
    });

    return NextResponse.json(
      {
        message: `Wallet ${nextStatus}`,
        status: nextStatus,
        balance: toRupees(wallet.availableBalance),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Status change failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Could not update the wallet status" },
      { status: 500 }
    );
  }
}

/**
 * Tells the customer their wallet was frozen, reactivated or closed.
 *
 * Silence here is the worst option: a customer whose payments start failing with no
 * explanation assumes the system is broken and contacts support, which is both a worse
 * experience and more work than one message.
 */
async function notifyStatusChange(params: {
  userId: string;
  walletType: string;
  status: WalletStatus;
  reason?: string;
  balancePaise: number;
}) {
  try {
    const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
    const label = params.walletType === "business" ? "Business Wallet" : "Store Wallet";

    const message =
      params.status === "frozen"
        ? `Your ${label} has been temporarily frozen. Your balance of ${formatPaise(params.balancePaise)} is safe and your statement remains available.`
        : params.status === "closed"
          ? `Your ${label} has been closed.${params.reason ? ` Reason: ${params.reason}` : ""} Your transaction history remains available.`
          : `Your ${label} is active again.`;

    dispatchEventServer({
      eventType: "WALLET_STATUS_CHANGED",
      category: "payments",
      actor: { id: "SYSTEM", name: "FlexSell Wholesale", role: "system" },
      recipient: { customerId: params.userId, email: "", name: "Valued Customer", role: "both" },
      entity: { type: "wallet", id: params.userId },
      data: { walletType: params.walletType, status: params.status, message },
    });
  } catch (err) {
    console.error("[Wallet] Failed to notify a wallet status change:", err);
  }
}
