import Razorpay from "razorpay";
import WalletTransaction from "@/models/WalletTransaction";
import Wallet from "@/models/Wallet";
import { settleWalletRecharge } from "./walletRecharge";
import { RECHARGE_SWEEP_AFTER_MINUTES, HOLD_EXPIRY_MINUTES } from "./walletConstants";

/**
 * The three background jobs the wallet needs, as plain functions.
 *
 * Deliberately not routes. Vercel's Hobby plan allows **two cron jobs, each triggered once
 * per day**, and one of those two is already spent on `/api/orders/reap-abandoned`. That
 * leaves a single daily slot for the entire wallet — far too slow to be a customer's only
 * path to money they have already paid.
 *
 * So the work lives here and runs from two places:
 *
 *  - **Lazily, on read** (`settleStuckRecharges` scoped to one customer). The person
 *    waiting for their balance is the one who triggers the check, it costs nothing when
 *    nobody is waiting, and it resolves in seconds rather than up to a day.
 *  - **Daily, from the cron**, unscoped, as the backstop for customers who never return.
 *
 * That split is cheaper than a frequent cron would have been even on a paid plan: a
 * half-hourly schedule bills 48 invocations a day whether or not a payment is stuck.
 */

export interface SweepResult {
  checked: number;
  credited: number;
  stillPending: number;
  failed: number;
  errors: number;
}

function getRazorpay(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) return null;
  return new Razorpay({ key_id, key_secret });
}

/**
 * Settles recharges whose webhook never arrived.
 *
 * `userId` scopes it to one customer, which is what the lazy path uses: a customer opening
 * their wallet checks only their own stuck payments, so the read stays cheap and one
 * customer's backlog cannot slow another's page.
 */
export async function settleStuckRecharges(
  options: { userId?: string; limit?: number } = {}
): Promise<SweepResult> {
  const { userId, limit = 50 } = options;
  const result: SweepResult = { checked: 0, credited: 0, stillPending: 0, failed: 0, errors: 0 };

  const razorpay = getRazorpay();
  if (!razorpay) return result;

  const cutoff = new Date(Date.now() - RECHARGE_SWEEP_AFTER_MINUTES * 60 * 1000);
  const query: Record<string, unknown> = {
    status: "pending",
    source: "razorpay",
    createdAt: { $lt: cutoff },
    "metadata.razorpayOrderId": { $exists: true },
  };
  if (userId) query.userId = userId;

  const stuck = (await WalletTransaction.find(query)
    .select("_id createdAt metadata amount")
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean()) as Array<{
    _id: string;
    createdAt?: Date;
    amount: number;
    metadata?: { razorpayOrderId?: string };
  }>;

  result.checked = stuck.length;
  const ageOutBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const txn of stuck) {
    const rzpOrderId = txn.metadata?.razorpayOrderId;
    if (!rzpOrderId) continue;

    try {
      // Ask Razorpay what actually happened. Our pending row records only that we asked;
      // the gateway is the authority on whether money moved.
      const payments = await razorpay.orders.fetchPayments(rzpOrderId);
      const captured = (payments.items || []).find(
        (p: { status?: string }) => p.status === "captured"
      ) as { id?: string; amount?: number } | undefined;

      if (!captured?.id) {
        // No captured payment. Age it out eventually so the customer's pending list does
        // not grow forever — but only well past the cutoff, since a slow gateway is not
        // the same thing as an abandoned checkout.
        if (txn.createdAt && txn.createdAt < ageOutBefore) {
          await WalletTransaction.updateOne(
            { _id: txn._id, status: "pending" },
            { $set: { status: "failed", "metadata.failureReason": "no_captured_payment" } }
          );
          result.failed += 1;
        } else {
          result.stillPending += 1;
        }
        continue;
      }

      const settlement = await settleWalletRecharge({
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: captured.id,
        capturedPaise: Number(captured.amount || 0),
        source: "sweeper",
      });

      if (settlement.status === "credited") result.credited += 1;
      else if (settlement.status !== "already_settled") result.errors += 1;
    } catch (err) {
      // One bad row must not abort the pass — the next customer's money is waiting behind it.
      console.error(`[Wallet Maintenance] Recharge ${txn._id} failed:`, err);
      result.errors += 1;
    }
  }

  return result;
}

/**
 * Returns money reserved by checkouts that never completed.
 *
 * Held balance is invisible to the customer as spendable but counts against their total, so
 * an orphaned hold looks exactly like money that has gone missing.
 */
export async function releaseExpiredHolds(): Promise<{ released: number; amount: number }> {
  const cutoff = new Date(Date.now() - HOLD_EXPIRY_MINUTES * 60 * 1000);

  const stale = (await WalletTransaction.find({
    status: "pending",
    source: "order",
    createdAt: { $lt: cutoff },
  })
    .select("_id walletId amount")
    .limit(100)
    .lean()) as Array<{ _id: string; walletId: string; amount: number }>;

  let released = 0;
  let amount = 0;

  for (const hold of stale) {
    try {
      // Conditional on status so a checkout completing at this exact moment wins the race
      // and its money is not returned out from under a placed order.
      const claimed = await WalletTransaction.findOneAndUpdate(
        { _id: hold._id, status: "pending" },
        { $set: { status: "failed", "metadata.failureReason": "checkout_abandoned" } },
        { new: true }
      );
      if (!claimed) continue;

      await Wallet.updateOne(
        { _id: hold.walletId },
        { $inc: { heldBalance: -hold.amount, availableBalance: hold.amount } }
      );
      released += 1;
      amount += hold.amount;
    } catch (err) {
      console.error(`[Wallet Maintenance] Hold ${hold._id} release failed:`, err);
    }
  }

  return { released, amount };
}

export interface DriftReport {
  walletId: string;
  userId: string;
  walletType: string;
  ledgerBalance: number;
  recordedBalance: number;
  difference: number;
}

/**
 * Checks that every wallet's balance still equals its ledger.
 *
 * `sum(credits) - sum(debits)` must equal `availableBalance + heldBalance`. Silent drift is
 * the failure mode that destroys trust in a wallet, and it is undetectable from the UI —
 * the customer sees a balance and has no way to know it is wrong.
 *
 * Reports rather than repairs. An automatic correction would paper over the bug that caused
 * the drift, and the ledger is the record of truth, not the balance field.
 */
export async function reconcileWallets(limit = 500): Promise<DriftReport[]> {
  const wallets = (await Wallet.find({ status: { $ne: "closed" } })
    .select("_id userId type availableBalance heldBalance")
    .limit(limit)
    .lean()) as Array<{
    _id: string;
    userId: string;
    type: string;
    availableBalance: number;
    heldBalance: number;
  }>;

  if (wallets.length === 0) return [];

  const sums = (await WalletTransaction.aggregate([
    {
      $match: {
        walletId: { $in: wallets.map((w) => String(w._id)) },
        status: "success",
      },
    },
    {
      $group: {
        _id: "$walletId",
        credits: {
          $sum: {
            $cond: [{ $in: ["$type", ["CREDIT", "REFUND", "TRANSFER_IN"]] }, "$amount", 0],
          },
        },
        debits: {
          $sum: {
            $cond: [{ $in: ["$type", ["CREDIT", "REFUND", "TRANSFER_IN"]] }, 0, "$amount"],
          },
        },
      },
    },
  ])) as Array<{ _id: string; credits: number; debits: number }>;

  const byWallet = new Map(sums.map((s) => [s._id, s]));
  const drift: DriftReport[] = [];

  for (const wallet of wallets) {
    const sum = byWallet.get(String(wallet._id));
    const ledgerBalance = (sum?.credits || 0) - (sum?.debits || 0);
    const recordedBalance = wallet.availableBalance + wallet.heldBalance;

    if (ledgerBalance !== recordedBalance) {
      drift.push({
        walletId: String(wallet._id),
        userId: wallet.userId,
        walletType: wallet.type,
        ledgerBalance,
        recordedBalance,
        difference: recordedBalance - ledgerBalance,
      });
    }
  }

  return drift;
}
