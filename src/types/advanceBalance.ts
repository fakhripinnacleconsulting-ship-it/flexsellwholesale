import type { BaseDocument } from "./index";
import type { AdvanceBalanceType } from "@/lib/advanceBalanceConstants";

export type { AdvanceBalanceType };

export type AdvanceBalanceStatus = "active" | "frozen" | "closed";

export type AdvanceBalanceTransactionType =
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "ADJUSTMENT"
  | "REVERSAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export type AdvanceBalanceTransactionSource =
  | "razorpay"
  | "cash"
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "order"
  | "expense"
  | "transfer"
  | "system";

export type AdvanceBalanceTransactionStatus =
  | "pending"
  | "awaiting_approval"
  | "success"
  | "failed"
  | "reversed";

export type AdvanceBalanceActorRole = "Admin" | "Manager" | "Customer" | "System";

export interface AdvanceBalanceActor {
  userId?: string;
  name: string;
  role: AdvanceBalanceActorRole;
}

/**
 * Money on the wire is always **rupees**. Paise exist only inside the database and the
 * server-side helpers; the API edge converts, so no component ever holds a paise value.
 */
export interface AdvanceBalance extends BaseDocument {
  userId: string;
  type: AdvanceBalanceType;
  totalCredited: number;
  totalDebited: number;
  availableBalance: number;
  heldBalance: number;
  lowBalanceThreshold: number;
  status: AdvanceBalanceStatus;
  closureReason?: string;
}

export interface AdvanceBalanceTransaction extends BaseDocument {
  walletId: string;
  userId: string;
  walletType: AdvanceBalanceType;
  type: AdvanceBalanceTransactionType;
  source: AdvanceBalanceTransactionSource;
  expenseCategory?: string;
  transactionName: string;
  amount: number;
  description?: string;
  balanceBefore: number;
  balanceAfter: number;
  receiptNumber: string;
  receiptUrl?: string;
  invoiceId?: string;
  orderId?: string;
  referenceId?: string;
  paymentId?: string;
  clientRequestId?: string;
  proofUrl?: string;
  counterpartTxnId?: string;
  status: AdvanceBalanceTransactionStatus;
  reversalOf?: string;
  createdBy: AdvanceBalanceActor;
  metadata?: Record<string, unknown>;
}

export interface AdvanceBalanceExpenseCategory extends BaseDocument {
  key: string;
  label: string;
  colour: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * A Advance Balance as the API returns it.
 *
 * Distinct from the stored document on purpose: amounts arrive as **rupees**, and
 * `isLowBalance` is computed server-side so the threshold comparison cannot drift between
 * the two screens that show it.
 */
export interface AdvanceBalanceView extends AdvanceBalance {
  isLowBalance: boolean;
}

/**
 * A ledger row as the API returns it.
 *
 * Carries fields the stored document does not: the category's resolved label and colour,
 * the credit/debit direction, and the acting person — all denormalised at read time so a
 * table row needs no further lookups.
 */
export interface AdvanceBalanceTransactionView {
  _id: string;
  createdAt: string;
  walletType: AdvanceBalanceType;
  type: AdvanceBalanceTransactionType;
  source: AdvanceBalanceTransactionSource;
  direction: "credit" | "debit";
  transactionName: string;
  description?: string;
  expenseCategory?: string;
  categoryLabel?: string;
  categoryColour?: string;
  amount: number;
  balanceAfter: number;
  receiptNumber: string;
  referenceId?: string;
  orderId?: string;
  invoiceId?: string;
  proofUrl?: string;
  status: AdvanceBalanceTransactionStatus;
  /** Name of the admin or manager who created the entry. Absent for customer actions. */
  actedBy?: string;
  actedByRole?: AdvanceBalanceActorRole;
}

/** One slice of the "where your money went" aggregation (§6). */
export interface AdvanceBalanceBreakdownSlice {
  categoryKey: string;
  label: string;
  colour: string;
  total: number;
  percent: number;
  count: number;
}

export interface AdvanceBalanceBreakdown {
  walletType: AdvanceBalanceScope;
  from: string;
  to: string;
  slices: AdvanceBalanceBreakdownSlice[];
  totalSpent: number;
}

/**
 * A Advance Balance scope for *reading*: either Advance Balance, or both together.
 *
 * Distinct from `AdvanceBalanceType` on purpose — a balance, an expense or a recharge always belongs
 * to one Advance Balance, so only the read surfaces (breakdown, passbook, statement) accept `"all"`.
 */
export type AdvanceBalanceScope = AdvanceBalanceType | "all";

/** A passbook page: rows plus the balances that make the range reconcilable. */
export interface AdvanceBalanceStatementPage {
  walletType: AdvanceBalanceScope;
  /**
   * True when both advanceBalances are shown together.
   *
   * A running balance is per-wallet: interleaving two wallets' rows by date makes
   * `balanceAfter` jump between two unrelated totals. The passbook hides the Balance column
   * when this is set, and the opening/closing pair is withheld rather than invented.
   */
  combined?: boolean;
  from: string;
  to: string;
  openingBalance: number | null;
  closingBalance: number | null;
  totalCredits: number;
  totalDebits: number;
  transactions: AdvanceBalanceTransactionView[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AdvanceBalanceSummary {
  store: AdvanceBalanceView | null;
  business: AdvanceBalanceView | null;
  businessEligible: boolean;
  kycApproved: boolean;
  /** False when an admin has switched online top-up off, or the gateway is unconfigured. */
  onlineRechargeAvailable: boolean;
  onlineRechargeReason: "ok" | "disabled_by_admin" | "gateway_not_configured";
}

/** Payload for a staff-recorded expense. `clientRequestId` is the idempotency key (§10.2). */
export interface RecordExpenseInput {
  userId: string;
  walletType: AdvanceBalanceType;
  expenseCategory: string;
  transactionName: string;
  amount: number;
  description?: string;
  referenceId?: string;
  proofUrl?: string;
  clientRequestId: string;
}

export interface OfflineCreditInput {
  userId: string;
  walletType: AdvanceBalanceType;
  source: Extract<AdvanceBalanceTransactionSource, "cash" | "bank_transfer" | "upi" | "cheque">;
  amount: number;
  referenceId?: string;
  description?: string;
  proofUrl?: string;
  clientRequestId: string;
  adminPassword: string;
}

export interface RechargeInitiateInput {
  walletType: AdvanceBalanceType;
  amount: number;
  termsAccepted: boolean;
  kycWarningAccepted?: boolean;
  /** Admin-only: whose Advance Balance to top up. Ignored when a customer sends it. */
  userId?: string;
}
