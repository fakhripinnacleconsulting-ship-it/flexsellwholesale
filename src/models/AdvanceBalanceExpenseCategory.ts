import mongoose, { Schema } from "mongoose";

/**
 * The controlled vocabulary behind the expense breakdown.
 *
 * Stored as data rather than a constant in a component so FlexSell can add "Amazon Listing
 * Fee" next month without a deploy — which is the entire point of having a category field.
 *
 * `colour` lives here, not in the chart, so a category keeps the same colour on every
 * screen and in every period. A donut that reshuffles its colours between months is worse
 * than one with no colour at all.
 */
const AdvanceBalanceExpenseCategorySchema = new Schema(
  {
    /** Stable key stored on transactions. Never changes once issued. */
    key: { type: String, required: true, trim: true },

    /** Display name. Safe to rename — historic rows follow, because they store the key. */
    label: { type: String, required: true, trim: true },

    colour: { type: String, required: true },
    sortOrder: { type: Number, default: 500 },

    /**
     * Soft delete only.
     *
     * Removing a category outright would orphan every historic transaction that referenced
     * it, breaking both the passbook label and the breakdown grouping for periods already
     * shown to the customer. Deactivating hides it from the picker and leaves the past
     * intact.
     */
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AdvanceBalanceExpenseCategorySchema.index({ key: 1 }, { unique: true });
AdvanceBalanceExpenseCategorySchema.index({ isActive: 1, sortOrder: 1 });

// Collection pinned — see the note in AdvanceBalance.ts.
export default mongoose.models.AdvanceBalanceExpenseCategory ||
  mongoose.model("AdvanceBalanceExpenseCategory", AdvanceBalanceExpenseCategorySchema, "walletexpensecategories");
