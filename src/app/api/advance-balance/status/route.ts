import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AdvanceBalance from "@/models/AdvanceBalance";
import { requireAdvanceBalanceAdmin, verifyAdminPassword } from "@/lib/advanceBalanceGuard";
import { toRupees, formatPaise } from "@/lib/money";
import { ADVANCE_BALANCE_TYPES } from "@/lib/advanceBalanceConstants";

export const dynamic = "force-dynamic";

const ALLOWED = ["active", "frozen", "closed"] as const;
type AdvanceBalanceStatus = (typeof ALLOWED)[number];

/**
 * Freezes, unfreezes or closes a advanceBalance.
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
    const auth = await requireAdvanceBalanceAdmin();
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    const { userId, walletType, status, reason, adminPassword } = await request.json();

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ message: "Customer is required" }, { status: 400 });
    }
    if (!ADVANCE_BALANCE_TYPES.includes(walletType)) {
      return NextResponse.json({ message: "Unknown Advance Balance type" }, { status: 400 });
    }
    if (!ALLOWED.includes(status)) {
      return NextResponse.json({ message: "Unknown status" }, { status: 400 });
    }

    const nextStatus = status as AdvanceBalanceStatus;

    /**
     * The reason is mandatory, and required as a *field* rather than encouraged.
     *
     * Closure with a leftover balance is an admin judgement made case by case. A
     * case-by-case policy with no recorded rationale is indistinguishable from an arbitrary
     * one when it is questioned six months later.
     */
    if (nextStatus !== "active" && (!reason || String(reason).trim().length < 5)) {
      return NextResponse.json(
        { message: `Give a reason for ${nextStatus === "closed" ? "closing" : "freezing"} this Advance Balance` },
        { status: 400 }
      );
    }

    await dbConnect();

    const advanceBalance = await AdvanceBalance.findOne({ userId, type: walletType });
    if (!advanceBalance) return NextResponse.json({ message: "Wallet not found" }, { status: 404 });

    if (advanceBalance.status === nextStatus) {
      return NextResponse.json({ message: `This Advance Balance is already ${nextStatus}` }, { status: 409 });
    }

    // Closing a Advance Balance that still holds money is the decision worth pausing on, so it asks
    // for the password regardless of amount.
    if (nextStatus === "closed" && advanceBalance.availableBalance > 0) {
      const check = await verifyAdminPassword(payload.userId, adminPassword);
      if (!check.ok) return check.error;
    }

    if (nextStatus === "closed" && advanceBalance.heldBalance > 0) {
      return NextResponse.json(
        {
          message:
            "This Advance Balance has money held for an order in progress. Wait for that order to settle before closing.",
        },
        { status: 409 }
      );
    }

    const previousStatus = advanceBalance.status;
    advanceBalance.status = nextStatus;
    if (nextStatus === "closed") advanceBalance.closureReason = String(reason).trim();
    await advanceBalance.save();

    /**
     * A status change is recorded on the Advance Balance, deliberately **not** in the ledger.
     *
     * It moves no money, and the transaction collection is what reconciliation sums. An
     * entry there would need an amount, and any non-zero amount — even a one-paise marker —
     * would show up as drift on the very report that exists to prove the ledger and the
     * balance agree.
     *
     * The customer still sees the state: the Advance Balance card renders a status badge and the
     * closure reason, so a frozen Advance Balance explains itself rather than looking broken.
     */
    console.warn(
      `[advanceBalance] ${walletType} Advance Balance for ${userId}: ${previousStatus} -> ${nextStatus} by ` +
        `${actor.name} (${actor.role}). Reason: ${reason ? String(reason).trim() : "n/a"}. ` +
        `Balance at change: ${formatPaise(advanceBalance.availableBalance)}`
    );

    void notifyStatusChange({
      userId,
      walletType,
      status: nextStatus,
      reason: reason ? String(reason).trim() : undefined,
      balancePaise: advanceBalance.availableBalance,
    });

    return NextResponse.json(
      {
        message: `Advance Balance ${nextStatus}`,
        status: nextStatus,
        balance: toRupees(advanceBalance.availableBalance),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[advanceBalance] Status change failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Could not update the Advance Balance status" },
      { status: 500 }
    );
  }
}

/**
 * Tells the customer their Advance Balance was frozen, reactivated or closed.
 *
 * Silence here is the worst option: a customer whose payments start failing with no
 * explanation assumes the system is broken and contacts support, which is both a worse
 * experience and more work than one message.
 */
async function notifyStatusChange(params: {
  userId: string;
  walletType: string;
  status: AdvanceBalanceStatus;
  reason?: string;
  balancePaise: number;
}) {
  try {
    const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
    const label = params.walletType === "business" ? "Business Advance Balance" : "Store Advance Balance";

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
    console.error("[advanceBalance] Failed to notify a Advance Balance status change:", err);
  }
}
