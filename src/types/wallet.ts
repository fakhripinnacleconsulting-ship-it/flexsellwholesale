import type { BaseDocument } from "./index";
import type { WalletType } from "@/lib/walletConstants";

export type { WalletType };

export type WalletStatus = "active" | "frozen" | "closed";

export type WalletTransactionType =
  | "CREDIT"
  | "DEBIT"
  | "REFUND"
  | "ADJUSTMENT"
  | "REVERSAL"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

export type WalletTransactionSource =
  | "razorpay"
  | "cash"
  | "bank_transfer"
  | "upi"
  | "cheque"
  | "order"
  | "expense"
  | "transfer"
  | "system";

export type WalletTransactionStatus =
  | "pending"
  | "awaiting_approval"
  | "success"
  | "failed"
  | "reversed";

export type WalletActorRole = "Admin" | "Manager" | "Customer" | "System";

export interface WalletActor {
  userId?: string;
  name: string;
  role: WalletActorRole;
}

/**
 * Money on the wire is always **rupees**. Paise exist only inside the database and the
 * server-side helpers; the API edge converts, so no component ever holds a paise value.
 */
export interface Wallet extends BaseDocument {
  userId: string;
  type: WalletType;
  totalCredited: number;
  totalDebited: number;
  availableBalance: number;
  heldBalance: number;
  lowBalanceThreshold: number;
  status: WalletStatus;
  closureReason?: string;
}

export interface WalletTransaction extends BaseDocument {
  walletId: string;
  userId: string;
  walletType: WalletType;
  type: WalletTransactionType;
  source: WalletTransactionSource;
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
  status: WalletTransactionStatus;
  reversalOf?: string;
  createdBy: WalletActor;
  metadata?: Record<string, unknown>;
}

export interface WalletExpenseCategory extends BaseDocument {
  key: string;
  label: string;
  colour: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * A wallet as the API returns it.
 *
 * Distinct from the stored document on purpose: amounts arrive as **rupees**, and
 * `isLowBalance` is computed server-side so the threshold comparison cannot drift between
 * the two screens that show it.
 */
export interface WalletView extends Wallet {
  isLowBalance: boolean;
}

/**
 * A ledger row as the API returns it.
 *
 * Carries fields the stored document does not: the category's resolved label and colour,
 * the credit/debit direction, and the acting person — all denormalised at read time so a
 * table row needs no further lookups.
 */
export interface WalletTransactionView {
  _id: string;
  createdAt: string;
  walletType: WalletType;
  type: WalletTransactionType;
  source: WalletTransactionSource;
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
  status: WalletTransactionStatus;
  /** Name of the admin or manager who created the entry. Absent for customer actions. */
  actedBy?: string;
  actedByRole?: WalletActorRole;
}

/** One slice of the "where your money went" aggregation (§6). */
export interface WalletBreakdownSlice {
  categoryKey: string;
  label: string;
  colour: string;
  total: number;
  percent: number;
  count: number;
}

export interface WalletBreakdown {
  walletType: WalletScope;
  from: string;
  to: string;
  slices: WalletBreakdownSlice[];
  totalSpent: number;
}

/**
 * A wallet scope for *reading*: either wallet, or both together.
 *
 * Distinct from `WalletType` on purpose — a balance, an expense or a recharge always belongs
 * to one wallet, so only the read surfaces (breakdown, passbook, statement) accept `"all"`.
 */
export type WalletScope = WalletType | "all";

/** A passbook page: rows plus the balances that make the range reconcilable. */
export interface WalletStatementPage {
  walletType: WalletScope;
  /**
   * True when both wallets are shown together.
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
  transactions: WalletTransactionView[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface WalletSummary {
  store: WalletView | null;
  business: WalletView | null;
  businessEligible: boolean;
  kycApproved: boolean;
  /** False when an admin has switched online top-up off, or the gateway is unconfigured. */
  onlineRechargeAvailable: boolean;
  onlineRechargeReason: "ok" | "disabled_by_admin" | "gateway_not_configured";
}

/** Payload for a staff-recorded expense. `clientRequestId` is the idempotency key (§10.2). */
export interface RecordExpenseInput {
  userId: string;
  walletType: WalletType;
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
  walletType: WalletType;
  source: Extract<WalletTransactionSource, "cash" | "bank_transfer" | "upi" | "cheque">;
  amount: number;
  referenceId?: string;
  description?: string;
  proofUrl?: string;
  clientRequestId: string;
  adminPassword: string;
}

export interface RechargeInitiateInput {
  walletType: WalletType;
  amount: number;
  termsAccepted: boolean;
  kycWarningAccepted?: boolean;
  /** Admin-only: whose wallet to top up. Ignored when a customer sends it. */
  userId?: string;
}
