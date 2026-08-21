import AdvanceBalance from "@/models/AdvanceBalance";
import AdvanceBalanceTransaction from "@/models/AdvanceBalanceTransaction";
import { runInTransaction } from "./transactionHelper";
import { nextReceiptNumber, getOrCreateAdvanceBalance } from "./advanceBalanceLedger";
import type { AdvanceBalanceType } from "./advanceBalanceConstants";
import type { AdvanceBalanceActor } from "@/types/advanceBalance";

/**
 * Settling a Advance Balance recharge — shared by the Razorpay webhook and the browser callback.
 *
 * Whichever arrives first wins and the other is a no-op, mirroring how `settleOrderPayment`
 * already handles order payments. That symmetry matters: a customer who closes the tab
 * right after paying must still get their balance.
 */

export type RechargeSettlement =
  | { status: "credited"; transactionId: string; balancePaise: number }
  | { status: "already_settled"; transactionId: string }
  | { status: "not_found" }
  | { status: "amount_mismatch"; expectedPaise: number; receivedPaise: number };
// A frozen or closed Advance Balance is deliberately absent from this union: it throws rather than
// returning, so the claim rolls back and the recharge stays pending for a human to resolve.
// Listing it as an outcome would invite a caller to "handle" it by discarding the payment.

interface SettleInput {
  /** The pending transaction minted at /initiate. Looked up by Razorpay order id. */
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Amount Razorpay actually captured, in paise. */
  capturedPaise: number;
  source: "webhook" | "callback" | "sweeper";
}

/**
 * Credits a Advance Balance against a payment Razorpay has confirmed.
 *
 * Idempotency has two independent guards, deliberately:
 *
 *  1. The **conditional flip** `{ status: "pending" }` → `success`. Only one caller can win
 *     that update, so a webhook retry racing the browser callback settles exactly once.
 *  2. The **unique sparse index on `paymentId`**. Even if the flip were somehow bypassed,
 *     the database refuses a second entry carrying the same payment.
 *
 * "Check then write" would satisfy neither: two concurrent retries both read `pending`,
 * both pass, and the Advance Balance is credited twice.
 */
export async function settleAdvanceBalanceTopUp(input: SettleInput): Promise<RechargeSettlement> {
  const { razorpayOrderId, razorpayPaymentId, capturedPaise, source } = input;

  const pending = await AdvanceBalanceTransaction.findOne({
    "metadata.razorpayOrderId": razorpayOrderId,
  }).lean() as
    | {
        _id: string;
        userId: string;
        walletId: string;
        walletType: AdvanceBalanceType;
        amount: number;
        status: string;
      }
    | null;

  if (!pending) return { status: "not_found" };

  if (pending.status === "success") {
    return { status: "already_settled", transactionId: String(pending._id) };
  }

  /**
   * The amount is the one *we* stored when minting the Razorpay order, never the one the
   * payload carries. A captured amount that disagrees means the payment does not belong to
   * this intent, and crediting the larger of the two would be the exploitable direction.
   */
  if (capturedPaise !== pending.amount) {
    console.error(
      `[advanceBalance] Amount mismatch on ${razorpayOrderId} (${source}): expected ${pending.amount} paise, ` +
        `Razorpay captured ${capturedPaise}. Not crediting.`
    );
    return { status: "amount_mismatch", expectedPaise: pending.amount, receivedPaise: capturedPaise };
  }

  return runInTransaction(async (session) => {
    // Guard 1: claim the settlement. A loser sees null and reports already-settled.
    const claimed = await AdvanceBalanceTransaction.findOneAndUpdate(
      { _id: pending._id, status: "pending" },
      { $set: { paymentId: razorpayPaymentId, "metadata.settledVia": source } },
      { new: true, session }
    );

    if (!claimed) {
      return { status: "already_settled" as const, transactionId: String(pending._id) };
    }

    const advanceBalance = await AdvanceBalance.findOneAndUpdate(
      { _id: pending.walletId, status: "active" },
      { $inc: { availableBalance: pending.amount, totalCredited: pending.amount } },
      { new: true, session }
    );

    if (!advanceBalance) {
      // Frozen or closed between initiate and capture. Throwing rolls the claim back so
      // the transaction stays pending and a human can resolve it — silently keeping the
      // money with no balance and no pending record would be the worst outcome.
      throw new Error(
        `Advance Balance ${pending.walletId} is not active; recharge ${razorpayPaymentId} could not be credited`
      );
    }

    const receiptNumber = await nextReceiptNumber("credit");

    await AdvanceBalanceTransaction.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "success",
          receiptNumber,
          balanceBefore: advanceBalance.availableBalance - pending.amount,
          balanceAfter: advanceBalance.availableBalance,
        },
      },
      { session }
    );

    return {
      status: "credited" as const,
      transactionId: String(claimed._id),
      balancePaise: advanceBalance.availableBalance,
    };
  });
}

/**
 * Records the intent to recharge, before the customer reaches Razorpay.
 *
 * The pending entry is what makes the amount server-authoritative: the webhook matches
 * `razorpayOrderId` back to this row and credits *that* amount, so a tampered checkout
 * payload cannot buy ₹30,000 of balance for ₹1.
 *
 * It carries no receipt number and moves no balance — both happen at settlement.
 */
export async function createPendingRecharge(params: {
  userId: string;
  walletType: AdvanceBalanceType;
  amountPaise: number;
  actor: AdvanceBalanceActor;
  termsVersion: string;
  kycPending: boolean;
  /**
   * True when an admin started this on the customer's behalf — a counter or telephone sale.
   *
   * Recorded because it changes what the terms acknowledgement means: the admin accepted them
   * for the customer rather than the customer accepting them for themselves. A dispute needs
   * to be able to tell those apart.
   */
  initiatedByStaff?: boolean;
}) {
  const advanceBalance = await getOrCreateAdvanceBalance(params.userId, params.walletType);
  if (!advanceBalance) throw new Error("Wallet could not be resolved");
  if (advanceBalance.status !== "active") {
    throw new Error(`This Advance Balance is ${advanceBalance.status} and cannot be recharged.`);
  }

  const [transaction] = await AdvanceBalanceTransaction.create([
    {
      walletId: String(advanceBalance._id),
      userId: params.userId,
      walletType: params.walletType,
      type: "CREDIT",
      source: "razorpay",
      transactionName: "Wallet Recharge",
      amount: params.amountPaise,
      // Placeholders until settlement. A pending row is not part of the ledger yet, so
      // these must not be read as balances — `status` is what distinguishes them.
      balanceBefore: 0,
      balanceAfter: 0,
      receiptNumber: `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      createdBy: params.actor,
      metadata: {
        termsAcceptedAt: new Date(),
        termsVersion: params.termsVersion,
        kycPendingAtRecharge: params.kycPending,
        ...(params.initiatedByStaff
          ? { initiatedByStaff: true, termsAcceptedBy: "staff_on_behalf_of_customer" }
          : {}),
      },
    },
  ]);

  return transaction;
}
