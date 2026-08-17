import mongoose, { Schema } from "mongoose";
import { WALLET_TYPES, DEFAULT_LOW_BALANCE_PAISE } from "@/lib/walletConstants";

/**
 * One balance, of one type, for one customer.
 *
 * Every amount here is **integer paise**, never rupees. The rest of the codebase stores
 * rupees; the conversion happens once at the API edge (see lib/money.ts) so that no two
 * places can disagree about the unit.
 *
 * Store and Business wallets share this schema rather than getting a model each: the hard
 * parts — atomic balance movement, the append-only ledger, reconciliation — are identical,
 * and duplicating them means fixing every future bug twice. What differs between the two
 * is who may spend, and that lives in the routes.
 */
const WalletSchema = new Schema(
  {
    userId: { type: String, required: true },
    type: { type: String, enum: WALLET_TYPES, required: true },

    totalCredited: { type: Number, default: 0, min: 0 },
    totalDebited: { type: Number, default: 0, min: 0 },

    /**
     * Spendable right now. Excludes heldBalance.
     *
     * `min: 0` is a last line of defence, not the mechanism: overdraft is actually
     * prevented by the conditional update in the debit path, which only matches when the
     * balance is already sufficient. This bound catches a write that bypassed it.
     */
    availableBalance: { type: Number, default: 0, min: 0 },

    /** Reserved by an in-flight checkout. Moves back to available if the order fails. */
    heldBalance: { type: Number, default: 0, min: 0 },

    lowBalanceThreshold: { type: Number, default: DEFAULT_LOW_BALANCE_PAISE, min: 0 },

    status: {
      type: String,
      enum: ["active", "frozen", "closed"],
      default: "active",
    },
    closureReason: { type: String },
  },
  { timestamps: true }
);

/** One wallet of each type per customer — the uniqueness the whole design assumes. */
WalletSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.models.Wallet || mongoose.model("Wallet", WalletSchema);
