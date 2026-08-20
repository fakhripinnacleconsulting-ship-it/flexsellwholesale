import Wallet from "@/models/Wallet";
import WalletTransaction from "@/models/WalletTransaction";
import { runInTransaction } from "./transactionHelper";
import { nextReceiptNumber, getOrCreateWallet, InsufficientBalanceError } from "./walletLedger";
import type { WalletActor } from "@/types/wallet";
import type { WalletType } from "./walletConstants";

/**
 * Paying for an order from a wallet: reserve, then capture.
 *
 * **Reserve before you debit.** The order (and its stock) has to exist before the money is
 * finally taken, so the sequence is: move the amount into `heldBalance`, create the order,
 * then capture. Debiting first and creating the order second means a failed order creation
 * leaves the customer poorer with nothing to show for it — and a wallet debit, unlike a
 * card authorisation, has no gateway that will quietly expire it.
 *
 * The hold is represented by a `pending` ledger row, so an abandoned checkout is visible
 * and recoverable rather than being an invisible gap between two balance fields.
 */

export interface HoldResult {
  holdId: string;
  walletId: string;
}

/**
 * Moves `amountPaise` from available to held, and records the intent.
 *
 * Throws `InsufficientBalanceError` when the balance is short — the conditional update is
 * what makes two simultaneous checkouts against one balance resolve to a single success.
 */
export async function reserveWalletFunds(params: {
  userId: string;
  walletType: WalletType;
  amountPaise: number;
  actor: WalletActor;
  clientRequestId: string;
  orderLabel: string;
}): Promise<HoldResult> {
  const { userId, walletType, amountPaise, actor, clientRequestId, orderLabel } = params;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Reservation amount must be a positive whole number of paise");
  }

  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(userId, walletType, session);
    if (!wallet) throw new Error("Wallet could not be resolved");
    if (wallet.status !== "active") {
      throw new Error(`This wallet is ${wallet.status} and cannot be used for payment.`);
    }

    const reserved = await Wallet.findOneAndUpdate(
      { _id: wallet._id, status: "active", availableBalance: { $gte: amountPaise } },
      { $inc: { availableBalance: -amountPaise, heldBalance: amountPaise } },
      { new: true, session }
    );

    /**
     * The reservation lost its guard, so the balance is short (or the wallet was frozen
     * between the read and this write). `wallet.availableBalance` is the figure that was
     * read a moment ago, which is what makes it possible to tell the user *how much* short
     * they are instead of just that they are.
     */
    if (!reserved) {
      throw new InsufficientBalanceError(walletType, {
        availablePaise: Number(wallet.availableBalance) || 0,
        requiredPaise: amountPaise,
      });
    }

    const [hold] = await WalletTransaction.create(
      [
        {
          walletId: String(wallet._id),
          userId,
          walletType,
          type: "DEBIT",
          source: "order",
          transactionName: orderLabel,
          amount: amountPaise,
          // Placeholders. A pending hold is not part of the ledger yet; `status` is what
          // distinguishes it, and the real balances are written at capture.
          balanceBefore: 0,
          balanceAfter: 0,
          receiptNumber: `HOLD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          status: "pending",
          clientRequestId,
          createdBy: actor,
          metadata: { heldAt: new Date() },
        },
      ],
      { session, ordered: true }
    );

    return { holdId: String(hold._id), walletId: String(wallet._id) };
  });
}

/**
 * Turns a hold into a real debit once the order exists.
 *
 * Conditional on `status: "pending"` so a capture racing the sweeper's release resolves to
 * exactly one outcome — the money is either taken for the order or returned, never both.
 */
export async function captureWalletFunds(params: {
  holdId: string;
  orderId: string;
}): Promise<{ transactionId: string; balancePaise: number } | null> {
  const { holdId, orderId } = params;

  return runInTransaction(async (session) => {
    const claimed = await WalletTransaction.findOneAndUpdate(
      { _id: holdId, status: "pending" },
      { $set: { orderId, transactionName: `Order ${orderId}` } },
      { new: true, session }
    );

    if (!claimed) return null;

    const wallet = await Wallet.findOneAndUpdate(
      { _id: claimed.walletId },
      // The money leaves `heldBalance`, not `availableBalance` — it was moved out of
      // available at reservation, so debiting it again here would take it twice.
      { $inc: { heldBalance: -claimed.amount, totalDebited: claimed.amount } },
      { new: true, session }
    );

    if (!wallet) throw new Error("Wallet vanished between reservation and capture");

    const receiptNumber = await nextReceiptNumber("debit");

    await WalletTransaction.updateOne(
      { _id: claimed._id },
      {
        $set: {
          status: "success",
          receiptNumber,
          // `availableBalance` was already reduced at reservation, so it is both the
          // before and the after for the customer's spendable figure.
          balanceBefore: wallet.availableBalance + claimed.amount,
          balanceAfter: wallet.availableBalance,
        },
      },
      { session }
    );

    return { transactionId: String(claimed._id), balancePaise: wallet.availableBalance };
  });
}

/**
 * Returns a hold to the spendable balance.
 *
 * Called when order creation fails or the customer abandons checkout. Also the sweeper's
 * path for holds nobody released — an orphaned hold looks to the customer exactly like
 * money that has gone missing.
 */
export async function releaseWalletFunds(holdId: string, reason: string): Promise<boolean> {
  return runInTransaction(async (session) => {
    const claimed = await WalletTransaction.findOneAndUpdate(
      { _id: holdId, status: "pending" },
      { $set: { status: "failed", "metadata.failureReason": reason } },
      { new: true, session }
    );

    if (!claimed) return false;

    await Wallet.updateOne(
      { _id: claimed.walletId },
      { $inc: { heldBalance: -claimed.amount, availableBalance: claimed.amount } },
      { session }
    );

    return true;
  });
}

/**
 * Refunds a wallet-paid order back into the wallet it was paid from.
 *
 * Not to source and not to a bank — balance is non-refundable, so money returns to the same
 * pot. A Business-Wallet-funded order refunds to the Business Wallet, never to the Store
 * Wallet, since that would let one-way-only money leak back into a spendable form.
 *
 * Idempotent on the original transaction: a second cancellation finds the row already
 * reversed and does nothing, so stock restoration retrying cannot double the refund.
 */
export async function refundWalletOrder(params: {
  walletTransactionId: string;
  orderId: string;
  actor: WalletActor;
  reason: string;
}): Promise<{ refunded: boolean; amountPaise?: number }> {
  const { walletTransactionId, orderId, actor, reason } = params;

  return runInTransaction(async (session) => {
    // Claiming the original marks it reversed, and the condition is what makes a repeated
    // cancellation a no-op rather than a second credit.
    const original = await WalletTransaction.findOneAndUpdate(
      { _id: walletTransactionId, status: "success", type: "DEBIT" },
      { $set: { status: "reversed" } },
      { new: true, session }
    );

    if (!original) return { refunded: false };

    const wallet = await Wallet.findOneAndUpdate(
      { _id: original.walletId },
      { $inc: { availableBalance: original.amount, totalDebited: -original.amount } },
      { new: true, session }
    );

    if (!wallet) throw new Error("Wallet not found while refunding an order");

    const receiptNumber = await nextReceiptNumber("credit");

    await WalletTransaction.create(
      [
        {
          walletId: original.walletId,
          userId: original.userId,
          walletType: original.walletType,
          type: "REFUND",
          source: "order",
          transactionName: `Refund for order ${orderId}`,
          description: reason,
          amount: original.amount,
          balanceBefore: wallet.availableBalance - original.amount,
          balanceAfter: wallet.availableBalance,
          receiptNumber,
          orderId,
          reversalOf: String(original._id),
          status: "success",
          createdBy: actor,
        },
      ],
      { session, ordered: true }
    );

    return { refunded: true, amountPaise: original.amount };
  });
}
