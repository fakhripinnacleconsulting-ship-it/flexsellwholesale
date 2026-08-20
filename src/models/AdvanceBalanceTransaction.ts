import mongoose, { Schema } from "mongoose";
import { ADVANCE_BALANCE_TYPES } from "@/lib/advanceBalanceConstants";

/**
 * Who performed the action, captured at write time.
 *
 * Deliberately denormalised rather than a reference to the staff account. A manager who
 * later leaves and is deleted would otherwise turn every one of their past entries into
 * "Unknown", and a renamed manager would silently rewrite history. The ledger is
 * append-only; the actor is part of the entry, not a lookup performed when it is read.
 *
 * Mirrors the actor shape in lib/orderHistory.ts — use resolveActor there rather than
 * building a second one.
 */
const AdvanceBalanceActorSchema = new Schema(
  {
    userId: { type: String },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["Admin", "Manager", "Customer", "System"],
      required: true,
    },
  },
  { _id: false }
);

/**
 * One immutable ledger entry.
 *
 * Entries are never edited or deleted. A correction is a new REVERSAL or ADJUSTMENT that
 * references the original, so the history can always be replayed — the same rule already
 * enforced on the order fulfilment stepper.
 *
 * All amounts are integer paise.
 */
const AdvanceBalanceTransactionSchema = new Schema(
  {
    walletId: { type: String, required: true },
    userId: { type: String, required: true },

    /** Denormalised from the Advance Balance so per-type queries need no join. */
    walletType: { type: String, enum: ADVANCE_BALANCE_TYPES, required: true },

    type: {
      type: String,
      enum: [
        "CREDIT",
        "DEBIT",
        "REFUND",
        "ADJUSTMENT",
        "REVERSAL",
        "TRANSFER_IN",
        "TRANSFER_OUT",
      ],
      required: true,
    },

    /**
     * Where the money came from or went.
     *
     * This is what makes an admin cash credit distinguishable from a Razorpay credit in
     * the passbook, in reconciliation, and in the offline-credit register. Without it,
     * money created by staff looks identical to money a payment gateway confirmed.
     */
    source: {
      type: String,
      enum: [
        "razorpay",
        "cash",
        "bank_transfer",
        "upi",
        "cheque",
        "order",
        "expense",
        "transfer",
        "system",
      ],
      required: true,
    },

    /** Controlled key from AdvanceBalanceExpenseCategory. Required when source is "expense". */
    expenseCategory: { type: String },

    transactionName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 1 },
    description: { type: String, trim: true },

    /** Both stored so the ledger can be replayed without recomputing from the start. */
    balanceBefore: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },

    receiptNumber: { type: String, required: true },
    receiptUrl: { type: String },

    /** Set when the entry is a taxable supply and carries its own GST invoice. */
    invoiceId: { type: String },

    /** Set when this entry paid for an order. */
    orderId: { type: String },

    referenceId: { type: String, trim: true },

    /** Razorpay payment id. Unique+sparse — this index IS the credit idempotency guard. */
    paymentId: { type: String },

    /**
     * Client-generated UUID, minted when the form opens rather than when it submits.
     *
     * Unique+sparse, and it is what stops a double-clicked "Record Expense" from writing
     * two debits. A content hash would be wrong here: two genuinely separate Rs 6,000 ad
     * spends on the same day are legitimate and must not collide. Intent is what must be
     * unique, and only the client knows where one intent ends and the next begins.
     */
    clientRequestId: { type: String },

    /** Cash slip or expense bill. Mandatory for offline credits and manager spends. */
    proofUrl: { type: String },

    /** The other half of a transfer pair. */
    counterpartTxnId: { type: String },

    status: {
      type: String,
      enum: ["pending", "awaiting_approval", "success", "failed", "reversed"],
      default: "success",
    },

    reversalOf: { type: String },

    createdBy: { type: AdvanceBalanceActorSchema, required: true },

    /**
     * Carries the per-recharge terms acknowledgement (termsAcceptedAt, termsVersion) and
     * the staff audit trail (ip). Kept on the transaction rather than the customer so a
     * dispute over one payment is answered by that payment's own record.
     */
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

/** Drives the passbook: one wallet's entries, newest first. */
AdvanceBalanceTransactionSchema.index({ userId: 1, walletType: 1, createdAt: -1 });

/** Drives the expense breakdown aggregation. */
AdvanceBalanceTransactionSchema.index({ walletId: 1, expenseCategory: 1 });

/**
 * The two idempotency guarantees.
 *
 * Sparse, because most entries have neither: a cash credit has no paymentId, and a
 * webhook-driven credit has no clientRequestId. A non-sparse unique index would reject
 * the second document with a null value.
 */
AdvanceBalanceTransactionSchema.index({ paymentId: 1 }, { unique: true, sparse: true });
AdvanceBalanceTransactionSchema.index({ clientRequestId: 1 }, { unique: true, sparse: true });

AdvanceBalanceTransactionSchema.index({ receiptNumber: 1 }, { unique: true });
AdvanceBalanceTransactionSchema.index({ orderId: 1 }, { sparse: true });

/** The webhook's lookup key: Razorpay order id back to the pending recharge that minted it. */
AdvanceBalanceTransactionSchema.index({ "metadata.razorpayOrderId": 1 }, { sparse: true });

/** Drives the stuck-recharge sweeper: pending rows, oldest first. */
AdvanceBalanceTransactionSchema.index({ status: 1, createdAt: 1 });

// Collection pinned — see the note in AdvanceBalance.ts. This one holds the append-only ledger.
export default mongoose.models.AdvanceBalanceTransaction ||
  mongoose.model("AdvanceBalanceTransaction", AdvanceBalanceTransactionSchema, "wallettransactions");
