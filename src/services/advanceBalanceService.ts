import { apiClient, isMockMode } from "@/lib/apiClient";
import type {
  AdvanceBalanceSummary,
  AdvanceBalanceBreakdown,
  AdvanceBalanceStatementPage,
  AdvanceBalanceExpenseCategory,
  RecordExpenseInput,
  OfflineCreditInput,
  RechargeInitiateInput,
  AdvanceBalanceType,
  AdvanceBalanceScope,
} from "@/types/advanceBalance";

/**
 * The only path between the browser and the Advance Balance API.
 *
 * No component performs its own fetch — that convention exists so authentication, CSRF and
 * error shape are decided once, and it matters more here than anywhere else in the codebase
 * because these calls move money.
 */

/**
 * Mock mode is **read-only** for wallets.
 *
 * Every other service falls back to localStorage when `isMockMode` is set, so the UI can be
 * developed offline. A Advance Balance cannot do that for writes: a mocked recharge that reports
 * success teaches the interface that money moved when nothing did, and the same code path
 * in the wrong environment is a phantom balance nobody can reconcile. Reads may be faked;
 * writes fail loudly.
 */
function assertWritable(action: string): void {
  if (isMockMode) {
    throw new Error(`${action} is unavailable in mock mode — Advance Balance writes require a real server.`);
  }
}

const EMPTY_SUMMARY: AdvanceBalanceSummary = {
  store: null,
  business: null,
  businessEligible: false,
  kycApproved: false,
  // Mock mode cannot take a payment, so top-up is reported unavailable rather than
  // offering a button that would throw.
  onlineRechargeAvailable: false,
  onlineRechargeReason: "gateway_not_configured",
};

type QueryValue = string | number | undefined;

function toQueryString(params: Record<string, QueryValue>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`;
}

/** Both advanceBalances and their balances. `userId` is staff-only; customers read their own. */
export async function getAdvanceBalances(userId?: string): Promise<AdvanceBalanceSummary> {
  if (isMockMode) return EMPTY_SUMMARY;
  return apiClient.get<AdvanceBalanceSummary>(`/advance-balance${toQueryString({ userId })}`, { cache: "no-store" });
}

export interface TransactionQuery {
  userId?: string;
  walletType?: AdvanceBalanceScope;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** A page of the passbook, with the opening and closing balances for the range. */
export async function getTransactions(query: TransactionQuery = {}): Promise<AdvanceBalanceStatementPage> {
  return apiClient.get<AdvanceBalanceStatementPage>(`/advance-balance/transactions${toQueryString({ ...query })}`, { cache: "no-store" });
}

/** Spend grouped by expense category. */
export async function getBreakdown(
  query: { userId?: string; walletType?: AdvanceBalanceScope; from?: string; to?: string } = {}
): Promise<AdvanceBalanceBreakdown> {
  return apiClient.get<AdvanceBalanceBreakdown>(`/advance-balance/breakdown${toQueryString({ ...query })}`, { cache: "no-store" });
}

export async function getExpenseCategories(includeInactive = false): Promise<AdvanceBalanceExpenseCategory[]> {
  return apiClient.get<AdvanceBalanceExpenseCategory[]>(
    `/advance-balance/categories${includeInactive ? "?includeInactive=1" : ""}`
  );
}

export interface RechargeSession {
  razorpayOrderId: string;
  amount: number;
  currency: string;
  walletTransactionId: string;
  keyId: string;
}

/** Starts a recharge. Returns the Razorpay handle for Checkout; no balance has moved yet. */
export async function initiateRecharge(input: RechargeInitiateInput): Promise<RechargeSession> {
  assertWritable("Adding money");
  return apiClient.post<RechargeSession>("/advance-balance/recharge/initiate", input);
}

export interface RechargeConfirmation {
  message: string;
  balance?: number;
  transactionId?: string;
}

/**
 * Confirms a recharge after Razorpay Checkout closes.
 *
 * Not the authority on the payment — the webhook is — but it makes the balance appear
 * immediately. Safe to call more than once; settlement is idempotent on both paths.
 */
export async function verifyRecharge(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<RechargeConfirmation> {
  assertWritable("Confirming payment");
  return apiClient.post<RechargeConfirmation>("/advance-balance/recharge/verify", payload);
}

export interface AdvanceBalanceWriteResult {
  message: string;
  transactionId?: string;
  receiptNumber?: string;
  balance?: number;
  duplicate?: boolean;
}

/**
 * Records a staff expense against a customer's wallet.
 *
 * `clientRequestId` must be generated when the form **opens**, not when it submits, and
 * must stay the same across retries of that one intent. That is what makes a double-click
 * or a retried request settle as one debit rather than two — and because the ledger is
 * append-only, a duplicate can only ever be undone by an admin reversal.
 */
export async function recordExpense(input: RecordExpenseInput): Promise<AdvanceBalanceWriteResult> {
  assertWritable("Recording an expense");
  return apiClient.post<AdvanceBalanceWriteResult>("/advance-balance/expense", input);
}

/** Admin-only: credits money received in cash, by bank transfer, UPI or cheque. */
export async function creditOffline(input: OfflineCreditInput): Promise<AdvanceBalanceWriteResult> {
  assertWritable("Adding funds");
  return apiClient.post<AdvanceBalanceWriteResult>("/advance-balance/credit-offline", input);
}

export interface OfflineRegisterEntry {
  _id: string;
  createdAt: string;
  userId: string;
  walletType: AdvanceBalanceType;
  source: string;
  amount: number;
  referenceId?: string;
  description?: string;
  proofUrl?: string;
  status: string;
  receiptNumber: string;
  recordedBy: string;
  recordedByIp?: string;
}

export interface OfflineRegister {
  days: number;
  totalCredited: number;
  summary: Array<{ admin: string; source: string; total: number; count: number }>;
  entries: OfflineRegisterEntry[];
}

/** Admin-only: every credit that did not come from the payment gateway, in one view. */
export async function getOfflineRegister(days = 30, adminId?: string): Promise<OfflineRegister> {
  return apiClient.get<OfflineRegister>(`/advance-balance/offline-register${toQueryString({ days, adminId })}`, { cache: "no-store" });
}

/** Pays for an existing order from the customer's own Store Wallet. */
export async function payOrderFromAdvanceBalance(params: {
  orderId: string;
  clientRequestId: string;
}): Promise<AdvanceBalanceWriteResult & { orderId?: string }> {
  assertWritable("Paying from your wallet");
  return apiClient.post<AdvanceBalanceWriteResult & { orderId?: string }>("/advance-balance/pay-order", params);
}

/** Admin-only: Pays for an existing order from a customer's Store or Business Wallet. */
export async function adminPayOrder(params: {
  orderId: string;
  customerId: string;
  walletType: "store" | "business";
  clientRequestId: string;
}): Promise<AdvanceBalanceWriteResult & { orderId?: string }> {
  assertWritable("Paying from a wallet");
  return apiClient.post<AdvanceBalanceWriteResult & { orderId?: string }>("/advance-balance/admin-pay-order", params);
}

/**
 * Admin-only: moves money from the Store Advance Balance to the Business Wallet.
 *
 * One direction only — there is no parameter for the reverse, because Business Advance Balance money
 * is services-only and non-refundable, and letting it flow back would undo both.
 */
export async function transferToBusinessAdvanceBalance(params: {
  userId: string;
  amount: number;
  reason?: string;
  adminPassword?: string;
}): Promise<{ message: string; storeBalance: number; businessBalance: number }> {
  assertWritable("Transferring");
  return apiClient.post("/advance-balance/transfer", params);
}

/** Admin-only: the only way to undo a ledger entry. Adds an opposing entry, never edits. */
export async function reverseTransaction(params: {
  transactionId: string;
  reason: string;
  adminPassword?: string;
}): Promise<{ message: string; reversalId: string; balance: number }> {
  assertWritable("Reversing a transaction");
  return apiClient.post("/advance-balance/reverse", params);
}

/** Admin-only: freeze, reactivate or close a wallet. History is always retained. */
export async function setAdvanceBalanceStatus(params: {
  userId: string;
  walletType: AdvanceBalanceType;
  status: "active" | "frozen" | "closed";
  reason?: string;
  adminPassword?: string;
}): Promise<{ message: string; status: string; balance: number }> {
  assertWritable("Changing the Advance Balance status");
  return apiClient.patch("/advance-balance/status", params);
}

/**
 * The statement download URL.
 *
 * Returned as a URL rather than fetched: the browser's own download handling gives the
 * customer a progress indicator and a file in their downloads folder, which a
 * fetch-then-blob would have to reimplement worse.
 */
export function statementUrl(
  query: { userId?: string; walletType?: AdvanceBalanceScope; from?: string; to?: string } = {}
): string {
  return `/api/advance-balance/statement${toQueryString({ ...query })}`;
}

/**
 * A fresh idempotency key for one write intent.
 *
 * Call this when a form opens and keep the value for the life of that form. Calling it at
 * submit time would defeat the purpose — every retry would look like a new intent.
 */
export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
