/**
 * Every Advance Balance number, key and label that more than one file needs.
 *
 * Kept in one module because the limits will change and the permission keys are
 * security-relevant: a typo'd permission string fails open in a `hasPerm` check that only
 * ever tests for presence.
 */

import { toPaise } from "./money";

export const ADVANCE_BALANCE_TYPES = ["store", "business"] as const;
export type AdvanceBalanceType = (typeof ADVANCE_BALANCE_TYPES)[number];

/** Recharge bounds, enforced server-side on /initiate. Decision 17. */
export const MIN_RECHARGE_PAISE = toPaise(500);
export const MAX_RECHARGE_PAISE = toPaise(200000);

/** Balance below which the customer sees a low-balance banner. */
export const DEFAULT_LOW_BALANCE_PAISE = toPaise(5000);

/**
 * Above this, an admin action re-verifies the admin's password (§25.7).
 *
 * The ConfirmDialog is shown for every high-risk action; the password is what this
 * threshold gates.
 */
export const ADMIN_REAUTH_THRESHOLD_PAISE = toPaise(50000);

/**
 * Permission keys for the two staff spend routes.
 *
 * Deliberately NOT granted by any wildcard: `verifyManagerOrderAccess` ends with a broad
 * `ops_shipping || orders` fallback that is fine for shipping and unacceptable for money,
 * which is why the Advance Balance has its own guard rather than reusing that one.
 */
export const ADVANCE_BALANCE_PERMISSIONS: Record<AdvanceBalanceType, string> = {
  store: "advance_balance_store",
  business: "advance_balance_business",
};

/**
 * The permission ids these replaced.
 *
 * They are not just strings in this file — they sit in every manager's `permissions` array in
 * the database. Matching on the new id alone would have cut off every existing manager's
 * access the moment it deployed, silently: a permission check does not fail loudly, it just
 * stops matching. Both are accepted until the backfill script has rewritten stored grants.
 */
export const LEGACY_ADVANCE_BALANCE_PERMISSIONS: Record<AdvanceBalanceType, string> = {
  store: "wallet_store",
  business: "wallet_business",
};

/** Every id that grants spend access to a balance — new and legacy. */
export function permissionsForAdvanceBalance(walletType: AdvanceBalanceType): string[] {
  return [ADVANCE_BALANCE_PERMISSIONS[walletType], LEGACY_ADVANCE_BALANCE_PERMISSIONS[walletType]];
}

/**
 * The payment-method strings that mean "paid from a balance".
 *
 * These travel in request bodies and are stored on `Invoice.paymentMethod`, which is a free
 * string — so documents raised before the rename hold `"Store Wallet"` forever. Every guard
 * that asks "is this a balance payment?" must therefore accept the old wording as well as the
 * new, or a historical invoice stops being recognised as wallet-settled and the routes that
 * refuse to hand-record a balance payment would let one through.
 *
 * Defined once here because the question was being asked in six routes with six hand-written
 * arrays, and they had already drifted — one omitted `"Wallet"`, another omitted the pair.
 */
export const ADVANCE_BALANCE_METHODS: Record<AdvanceBalanceType, string> = {
  store: "Store Advance Balance",
  business: "Business Advance Balance",
};

/** Superseded wording, still present on existing documents and in-flight requests. */
export const LEGACY_ADVANCE_BALANCE_METHODS: Record<AdvanceBalanceType, string> = {
  store: "Store Wallet",
  business: "Business Wallet",
};

/** Maps every accepted method string to the balance it names. */
export const METHOD_TO_WALLET_TYPE: Record<string, AdvanceBalanceType> = {
  [ADVANCE_BALANCE_METHODS.store]: "store",
  [ADVANCE_BALANCE_METHODS.business]: "business",
  [LEGACY_ADVANCE_BALANCE_METHODS.store]: "store",
  [LEGACY_ADVANCE_BALANCE_METHODS.business]: "business",
};

/**
 * Is this method a balance payment, whatever wording it uses?
 *
 * `"Wallet"` is included: it is what `Order.paymentMethod` held for every balance-paid order
 * before the rename, and some callers pass the order's method straight through.
 */
export function isAdvanceBalanceMethod(method?: string | null): boolean {
  if (!method) return false;
  return method === "Wallet" || method === "Advance Balance" || method in METHOD_TO_WALLET_TYPE;
}

/** The human label for a balance, e.g. in a toast or a statement header. */
export function advanceBalanceLabel(walletType: AdvanceBalanceType): string {
  return ADVANCE_BALANCE_METHODS[walletType];
}

/** Atomic counter ids for receipt numbering — see idGeneratorServer.nextCounterValue. */
export const ADVANCE_BALANCE_COUNTERS = {
  credit: "wallet_receipt",
  debit: "wallet_debit",
} as const;

export const ADVANCE_BALANCE_RECEIPT_PREFIX = {
  credit: "WR",
  debit: "WD",
} as const;

/**
 * Which customer tiers get which wallet. Decision 6.
 *
 * A B2C retail buyer has no use for GST registration or ad spend, so the Business Advance Balance
 * is not offered to them at all.
 */
export const BUSINESS_ADVANCE_BALANCE_TIERS = ["B2B", "Dropshipping"] as const;

/**
 * Terms version stamped onto every recharge acknowledgement (§15).
 *
 * Bump this whenever the disclosure wording changes. Storing `true` against wording nobody
 * kept is not evidence of anything; storing the version is.
 */
export const ADVANCE_BALANCE_TERMS_VERSION = "2026-08-15.1";

export const ADVANCE_BALANCE_TERMS_TEXT =
  "Advance Balance can be used for purchases and services on FlexSell only. " +
  "It cannot be withdrawn or transferred to a bank account. " +
  "You authorise FlexSell to spend this balance on your behalf for the services you request.";

/** Seed categories. Admin-editable at runtime — this list only bootstraps an empty database. */
export const SEED_EXPENSE_CATEGORIES: Array<{
  key: string;
  label: string;
  colour: string;
  sortOrder: number;
}> = [
  { key: "gst_registration", label: "GST Registration", colour: "#10b981", sortOrder: 10 },
  { key: "trademark_ip", label: "Trademark & IP", colour: "#0ea5e9", sortOrder: 20 },
  { key: "company_registration", label: "Company Registration", colour: "#6366f1", sortOrder: 30 },
  { key: "ads_meta", label: "Advertising — Meta", colour: "#8b5cf6", sortOrder: 40 },
  { key: "ads_google", label: "Advertising — Google", colour: "#ec4899", sortOrder: 50 },
  { key: "ads_other", label: "Advertising — Other", colour: "#f43f5e", sortOrder: 60 },
  { key: "website_domain", label: "Website & Domain", colour: "#f59e0b", sortOrder: 70 },
  { key: "photography", label: "Photography & Creatives", colour: "#eab308", sortOrder: 80 },
  { key: "legal_compliance", label: "Legal & Compliance", colour: "#14b8a6", sortOrder: 90 },
  { key: "government_fees", label: "Government Fees", colour: "#06b6d4", sortOrder: 100 },
  { key: "accounting", label: "Accounting & Filing", colour: "#3b82f6", sortOrder: 110 },
  { key: "logistics", label: "Logistics & Courier", colour: "#a855f7", sortOrder: 120 },
  { key: "platform_fees", label: "Platform / Listing Fees", colour: "#d946ef", sortOrder: 130 },
  { key: "other", label: "Other", colour: "#64748b", sortOrder: 999 },
];


/**
 * Why online Advance Balance top-up is unavailable, in words for each audience.
 *
 * Lives here rather than beside the settings *reader*: that module imports mongoose, and a
 * client component importing a message from it pulled the driver into the browser bundle.
 * Constants are client-safe; the reader is server-only.
 */
export const RECHARGE_UNAVAILABLE_MESSAGE: Record<string, string> = {
  disabled_by_admin:
    "Online Advance Balance top-up is currently unavailable. Please contact us to add funds by bank transfer, UPI or cash.",
  gateway_not_configured:
    "Online Advance Balance top-up is temporarily unavailable. Please contact us to add funds another way.",
};

/** Staff-facing text — states the cause, because staff can act on it. */
export const RECHARGE_UNAVAILABLE_STAFF_MESSAGE: Record<string, string> = {
  disabled_by_admin:
    "Online Advance Balance top-up is switched off in Settings → Commerce. Use Add Funds Offline, or turn it back on.",
  gateway_not_configured:
    "Razorpay keys are not configured, so online top-up cannot run. Use Add Funds Offline.",
};

/** Rows per passbook page. Paged server-side; never fetch-all-then-slice. */
export const PASSBOOK_PAGE_SIZE = 50;

/** Slices before the donut collapses the tail into "Other" (§25.4). */
export const BREAKDOWN_MAX_SLICES = 6;

/** How long a checkout hold survives before the sweeper releases it. */
export const HOLD_EXPIRY_MINUTES = 30;

/** How long a pending recharge waits before the sweeper re-queries Razorpay. */
export const RECHARGE_SWEEP_AFTER_MINUTES = 15;
