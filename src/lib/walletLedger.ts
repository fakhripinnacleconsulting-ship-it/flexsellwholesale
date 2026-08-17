import mongoose from "mongoose";
import Wallet from "@/models/Wallet";
import WalletTransaction from "@/models/WalletTransaction";
import { nextCounterValue } from "./idGeneratorServer";
import {
  WALLET_COUNTERS,
  WALLET_RECEIPT_PREFIX,
  DEFAULT_LOW_BALANCE_PAISE,
  type WalletType,
} from "./walletConstants";
import type {
  WalletActor,
  WalletTransactionSource,
  WalletTransactionType,
} from "@/types/wallet";

/**
 * The single writer for every balance change.
 *
 * Nothing outside this module may touch `availableBalance`, `heldBalance`, `totalCredited`
 * or `totalDebited`. That is what keeps the invariant checkable: if the ledger and the
 * balance ever disagree, there is exactly one place that could have caused it.
 */

/**
 * Adapts an order-history actor into a wallet actor.
 *
 * `HistoryActor.name` is optional; a ledger entry's is not. Attribution is the control that
 * replaces the caps and approvals this design does without, so a nameless entry would be a
 * silently broken one — the role is used as the fallback rather than leaving it blank.
 */
export function toWalletActor(actor: {
  role?: string;
  name?: string;
  userId?: string;
} | null | undefined): WalletActor {
  const role = (actor?.role || "System") as WalletActor["role"];
  return {
    role,
    name: actor?.name || role,
    userId: actor?.userId,
  };
}

/** Credits increase the balance; debits decrease it. Transfers are one of each. */
const CREDIT_TYPES: WalletTransactionType[] = ["CREDIT", "REFUND", "TRANSFER_IN"];

export function isCreditType(type: WalletTransactionType): boolean {
  return CREDIT_TYPES.includes(type);
}

/**
 * Thrown when a debit cannot proceed. Carries a 409 rather than a 500 because it is a
 * legitimate business outcome, not a fault — the caller should show it, not log it.
 */
export class InsufficientBalanceError extends Error {
  readonly status = 409;
  constructor(walletType: WalletType) {
    super(
      walletType === "business"
        ? "Insufficient Business Wallet Balance"
        : "Insufficient Store Wallet Balance"
    );
    this.name = "InsufficientBalanceError";
  }
}

export class WalletNotActiveError extends Error {
  readonly status = 409;
  constructor(status: string) {
    super(`This wallet is ${status}. No transactions can be recorded against it.`);
    this.name = "WalletNotActiveError";
  }
}

/**
 * Finds a customer's wallet, creating it on first use.
 *
 * Lazy creation rather than provisioning on signup: most customers never open a Business
 * Wallet, and hundreds of empty documents make every aggregate query slower for no gain.
 */
export async function getOrCreateWallet(
  userId: string,
  type: WalletType,
  session?: mongoose.ClientSession
) {
  const existing = await Wallet.findOne({ userId, type }).session(session || null);
  if (existing) return existing;

  // upsert rather than create: two concurrent first-uses would otherwise race, and the
  // unique index on { userId, type } would fail the loser with a duplicate-key error.
  await Wallet.updateOne(
    { userId, type },
    {
      $setOnInsert: {
        userId,
        type,
        totalCredited: 0,
        totalDebited: 0,
        availableBalance: 0,
        heldBalance: 0,
        lowBalanceThreshold: DEFAULT_LOW_BALANCE_PAISE,
        status: "active",
      },
    },
    { upsert: true, session }
  );

  return Wallet.findOne({ userId, type }).session(session || null);
}

/**
 * Issues the next receipt number.
 *
 * Runs outside any caller transaction by design — see `nextCounterValue`. A counter that
 * rolls back with an aborted transaction hands the same number to the next caller, and a
 * duplicated receipt number is worse than a skipped one.
 */
export async function nextReceiptNumber(direction: "credit" | "debit"): Promise<string> {
  const seq = await nextCounterValue(WALLET_COUNTERS[direction], async () => 0);
  return `${WALLET_RECEIPT_PREFIX[direction]}-${String(seq).padStart(6, "0")}`;
}

export interface LedgerWriteInput {
  userId: string;
  walletType: WalletType;
  type: WalletTransactionType;
  source: WalletTransactionSource;
  amountPaise: number;
  transactionName: string;
  actor: WalletActor;
  expenseCategory?: string;
  description?: string;
  referenceId?: string;
  paymentId?: string;
  clientRequestId?: string;
  proofUrl?: string;
  orderId?: string;
  invoiceId?: string;
  counterpartTxnId?: string;
  reversalOf?: string;
  status?: "pending" | "success";
  metadata?: Record<string, unknown>;
  session?: mongoose.ClientSession;
}

/**
 * Moves the balance and writes the matching ledger entry, atomically.
 *
 * The debit path uses a **conditional** update rather than read-then-write:
 *
 *     { _id, status: "active", availableBalance: { $gte: amount } }
 *
 * so the balance check and the decrement are one operation. Two concurrent Rs 800 debits
 * against a Rs 1,000 balance therefore resolve to exactly one success — with read-then-write
 * both would read 1,000, both would pass, and the wallet would go negative.
 *
 * Callers must wrap this in `runInTransaction` when they write anything else alongside it.
 */
export async function writeLedgerEntry(input: LedgerWriteInput) {
  const {
    userId,
    walletType,
    type,
    amountPaise,
    actor,
    session,
    status = "success",
  } = input;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error("Ledger amount must be a positive whole number of paise");
  }

  const wallet = await getOrCreateWallet(userId, walletType, session);
  if (!wallet) throw new Error("Wallet could not be resolved");
  if (wallet.status !== "active") throw new WalletNotActiveError(wallet.status);

  const credit = isCreditType(type);
  const balanceBefore = wallet.availableBalance;

  const updated = credit
    ? await Wallet.findOneAndUpdate(
        { _id: wallet._id, status: "active" },
        { $inc: { availableBalance: amountPaise, totalCredited: amountPaise } },
        { new: true, session }
      )
    : await Wallet.findOneAndUpdate(
        // The guard clause. A null result means the balance moved beneath us, or the
        // wallet was frozen between the read above and this write.
        { _id: wallet._id, status: "active", availableBalance: { $gte: amountPaise } },
        { $inc: { availableBalance: -amountPaise, totalDebited: amountPaise } },
        { new: true, session }
      );

  if (!updated) throw new InsufficientBalanceError(walletType);

  const receiptNumber = await nextReceiptNumber(credit ? "credit" : "debit");

  const [transaction] = await WalletTransaction.create(
    [
      {
        walletId: String(wallet._id),
        userId,
        walletType,
        type,
        source: input.source,
        expenseCategory: input.expenseCategory,
        transactionName: input.transactionName,
        amount: amountPaise,
        description: input.description,
        balanceBefore,
        balanceAfter: updated.availableBalance,
        receiptNumber,
        invoiceId: input.invoiceId,
        orderId: input.orderId,
        referenceId: input.referenceId,
        paymentId: input.paymentId,
        clientRequestId: input.clientRequestId,
        proofUrl: input.proofUrl,
        counterpartTxnId: input.counterpartTxnId,
        reversalOf: input.reversalOf,
        status,
        createdBy: actor,
        metadata: input.metadata,
      },
    ],
    { session, ordered: true }
  );

  return { transaction, wallet: updated };
}

/**
 * True when a write failed because an idempotency key was already used.
 *
 * Both `paymentId` and `clientRequestId` carry unique sparse indexes, so a replayed webhook
 * or a double-submitted form surfaces here as a duplicate-key error rather than as a second
 * balance movement. Callers treat it as success and return the original entry, because from
 * the caller's point of view the work *was* done.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number })?.code === 11000;
}

/** Finds the entry a replayed request was trying to create. */
export async function findExistingByIdempotencyKey(
  key: { paymentId?: string; clientRequestId?: string }
) {
  if (key.paymentId) return WalletTransaction.findOne({ paymentId: key.paymentId }).lean();
  if (key.clientRequestId) {
    return WalletTransaction.findOne({ clientRequestId: key.clientRequestId }).lean();
  }
  return null;
}
