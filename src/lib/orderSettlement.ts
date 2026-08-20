import InvoiceModel from "@/models/Invoice";
import { METHOD_TO_WALLET_TYPE } from "@/lib/advanceBalanceConstants";
import Order from "@/models/Order";
import { generateNextId } from "@/lib/idGeneratorServer";
import { formatDateIST } from "@/lib/datetime";
import { buildHistoryEvent, SYSTEM_ACTOR } from "@/lib/orderHistory";
import type { HistoryActor } from "@/types";

/**
 * Issuing the Tax Invoice once a payment has cleared — the one implementation.
 *
 * Five different code paths can make an order paid (Store Advance Balance, Business Advance Balance, the
 * Razorpay callback, the Razorpay webhook, and staff recording cash/UPI/transfer against a
 * receipt), and until this module existed only one of them — `/api/invoices/[id]/settle` —
 * produced the correct paperwork. The others each got it wrong in their own way:
 *
 *   - **The Advance Balance routes issued nothing at all.** They updated `Order` and never imported
 *     `Invoice`, so a wallet-paid order kept a `pending` receipt and `/admin/invoices` went
 *     on offering "Mark Paid" for money that had already been taken.
 *   - **Razorpay flipped `type` on the receipt in place.** `Invoice._id` is an assigned
 *     String and MongoDB will not change an `_id`, so every "Tax Invoice" that path produced
 *     kept its `RCP-`/`REC-` number and the `INV-` counter never advanced. GST Rule 46(b)
 *     requires a consecutive serial unique to the invoice series, which that design made
 *     impossible.
 *
 * So the rule is: **money moves in the caller, paperwork is issued here.** A *separate*
 * `INV-` document is created, the receipt is retained as the audit record of what was
 * collected, and the two point at each other.
 *
 * ## Idempotency
 * Every entry point is reachable twice — a double-clicked button, or the Razorpay webhook
 * racing the browser callback. Three independent guards make a second call a no-op:
 * `settledByInvoiceId` on the receipt, a lookup by `sourceReceiptId`, and finally the unique
 * sparse index on `sourceReceiptId` itself, which cannot be raced.
 *
 * ## Failure
 * A caller that has already taken the money must **not** unwind it because this failed. The
 * money legitimately paid the order; a missing document is a paperwork problem to be retried,
 * and refunding a genuinely paid order would be far worse. Callers log and continue.
 */

/**
 * The stored receipt, as this module needs to read it.
 *
 * A partial shape rather than the full `Invoice`: the remaining fields are copied verbatim
 * onto the invoice without being inspected, so naming them here would only invite drift.
 */
export interface StoredReceipt {
  _id: string;
  type: string;
  status?: string;
  amount?: number;
  customerId?: string;
  orderId?: string;
  notes?: string;
  settledByInvoiceId?: string;
  [key: string]: unknown;
}

export interface IssueInvoiceInput {
  /** The receipt being settled, as a lean object. */
  receipt: StoredReceipt;
  /** How the money arrived — "Wallet", "Razorpay", "Cash", "UPI", … */
  method: string;
  /** Gateway payment id, Advance Balance ledger id, UTR or cheque number. */
  transactionId?: string;
  /** The `AdvanceBalanceTransaction` row that paid this, when a Advance Balance paid it. */
  walletTransactionId?: string;
  walletType?: "store" | "business";
  /** Rupees taken from the Advance Balance, recorded on the order for reconciliation. */
  walletAmount?: number;
  /** Overrides the receipt's notes on the issued invoice when provided. */
  notes?: string;
  /** Who settled it. Always session-derived by the caller, never request input. */
  actor?: HistoryActor;
}

/**
 * `Order.paymentMethod` is a closed enum; `Invoice.paymentMethod` is a free string.
 *
 * That difference is deliberate — the document records *which* Advance Balance was charged
 * ("Business Advance Balance"), while the order stores the method as `"Wallet"` and keeps the Advance Balance
 * identity in its own `walletType` field. Writing the document's wording onto the order
 * therefore fails validation outright:
 *
 *     Order validation failed: paymentMethod: `Business Advance Balance` is not a valid enum value
 *
 * So every route that creates or updates an order from a document's method must translate it
 * here rather than passing it through.
 */
export const ORDER_PAYMENT_METHODS = [
  "Bank Transfer",
  "Razorpay",
  "UPI",
  "COD",
  "Advance Balance",
  // Legacy, still on every order paid from a balance before the rename.
  "Wallet",
  "Cash",
];

/** The Advance Balance a document-level method names, if it names one. */
export function walletTypeForMethod(method?: string): "store" | "business" | undefined {
  // Through the shared map, which also recognises the pre-rename wording. Matching only the
  // current strings would leave every document raised as "Store Wallet" unrecognised, and its
  // order would be written with the raw method instead of "Advance Balance" + walletType.
  return method ? METHOD_TO_WALLET_TYPE[method] : undefined;
}

/**
 * The order-safe form of a document's payment method.
 *
 * Returns `undefined` for anything the enum does not accept ("NEFT/RTGS", "Cheque") so the
 * caller can leave the field alone rather than writing a value that will fail to save later —
 * `findByIdAndUpdate` does not run validators, so an unmapped value would pass silently now
 * and break the next `save()`.
 */
export function orderPaymentMethodFor(method?: string, walletType?: "store" | "business"): string | undefined {
  // New orders record "Advance Balance"; the enum still accepts the legacy "Wallet" so the
  // rows already carrying it keep saving.
  if (walletType || walletTypeForMethod(method)) return "Advance Balance";
  return method && ORDER_PAYMENT_METHODS.includes(method) ? method : undefined;
}

export interface IssueInvoiceResult {
  invoiceId: string;
  receiptId: string;
  /** The created document, or the existing one when this was a repeat call. */
  invoice: unknown;
  alreadyIssued: boolean;
}

/** Fields the invoice must mint fresh rather than inherit from the receipt. */
const NOT_INHERITED = ["_id", "createdAt", "updatedAt", "sourceReceiptId", "settledByInvoiceId"];

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number })?.code === 11000;
}

/**
 * Issues the Tax Invoice for a receipt, retains and links the receipt, and syncs the order.
 *
 * The caller is responsible for having actually moved the money first, and for whatever
 * authorisation that required.
 */
export async function issueTaxInvoiceForReceipt(input: IssueInvoiceInput): Promise<IssueInvoiceResult> {
  const { receipt, method, transactionId, walletTransactionId, walletType, walletAmount, notes, actor } =
    input;
  const receiptId = String(receipt._id);

  // 1. Already settled? Both directions of the link are checked, because either one alone
  //    can be the survivor of a partially-completed earlier attempt.
  const existing = await findIssuedInvoice(receipt);
  if (existing) {
    return { invoiceId: existing._id, receiptId, invoice: existing, alreadyIssued: true };
  }

  // 2. Mint the invoice number and carry the receipt's content across.
  const invoiceId = await generateNextId("invoice");
  const now = new Date();
  const inherited: Record<string, unknown> = { ...receipt };
  for (const key of NOT_INHERITED) delete inherited[key];

  let invoice: unknown;
  try {
    invoice = await InvoiceModel.create({
      ...inherited,
      _id: invoiceId,
      type: "invoice",
      status: "paid",
      paymentStatus: "Paid",
      paymentMethod: method,
      transactionId,
      walletTransactionId,
      walletType,
      // The link that makes double-settlement impossible: unique sparse index.
      sourceReceiptId: receiptId,
      settledByInvoiceId: undefined,
      notes: notes !== undefined ? notes : receipt.notes,
      generatedAt: formatDateIST(now),
      issuedAt: now,
      // Mongoose cannot narrow a spread of the stored receipt against the schema type. The
      // spread fields are the receipt's own, already validated when it was created; the
      // fields that matter here are the explicit ones above.
    } as never);
  } catch (err) {
    /**
     * A concurrent caller won the race to the unique `sourceReceiptId` index.
     *
     * This is the guard the application-level checks above cannot provide, and reaching it
     * is a success, not a failure: the invoice this call wanted now exists.
     */
    if (isDuplicateKey(err)) {
      const winner = await findIssuedInvoice(receipt);
      if (winner) {
        return { invoiceId: winner._id, receiptId, invoice: winner, alreadyIssued: true };
      }
    }
    throw err;
  }

  // 3. Retain the receipt as the record of what was collected, and link it forward.
  await InvoiceModel.findByIdAndUpdate(receiptId, {
    $set: {
      status: "paid",
      paymentStatus: "Paid",
      paymentMethod: method,
      transactionId,
      walletTransactionId,
      walletType,
      settledByInvoiceId: invoiceId,
    },
  });

  // 4. Point the order at the Tax Invoice, not at the receipt it superseded.
  if (receipt.orderId) {
    await syncOrder({
      orderId: String(receipt.orderId),
      receiptId,
      invoiceId,
      method,
      transactionId,
      walletTransactionId,
      walletType,
      walletAmount,
      actor,
      at: now,
    });
  }

  return { invoiceId, receiptId, invoice, alreadyIssued: false };
}

export type SettleDocumentsResult =
  | { status: "issued"; invoiceId: string; receiptId: string }
  | { status: "already_issued"; invoiceId: string; receiptId: string }
  /** The order never had a receipt — it was born as a direct Tax Invoice. Not an error. */
  | { status: "no_receipt" };

export interface SettleDocumentsInput {
  orderId: string;
  method: string;
  transactionId?: string;
  walletTransactionId?: string;
  walletType?: "store" | "business";
  walletAmount?: number;
  actor?: HistoryActor;
}

/**
 * Settles the paperwork for an order that has just been paid.
 *
 * The order-keyed entry point, for callers that hold an order rather than a receipt: the two
 * Advance Balance routes and both Razorpay paths. An order placed by staff as already-paid has an
 * `INV-` from the start and no receipt at all, which is why `no_receipt` is a normal outcome
 * rather than a failure.
 */
export async function settleOrderDocuments(input: SettleDocumentsInput): Promise<SettleDocumentsResult> {
  const receipt = (await InvoiceModel.findOne({
    orderId: input.orderId,
    type: "receipt",
  }).lean()) as StoredReceipt | null;

  if (!receipt) return { status: "no_receipt" };

  const result = await issueTaxInvoiceForReceipt({
    receipt,
    method: input.method,
    transactionId: input.transactionId,
    walletTransactionId: input.walletTransactionId,
    walletType: input.walletType,
    walletAmount: input.walletAmount,
    actor: input.actor,
  });

  return {
    status: result.alreadyIssued ? "already_issued" : "issued",
    invoiceId: result.invoiceId,
    receiptId: result.receiptId,
  };
}

/** The invoice already issued for this receipt, by either side of the link. */
async function findIssuedInvoice(receipt: StoredReceipt): Promise<{ _id: string } | null> {
  if (receipt.settledByInvoiceId) {
    const linked = (await InvoiceModel.findById(receipt.settledByInvoiceId).lean()) as
      | { _id: string }
      | null;
    if (linked) return linked;
  }
  return (await InvoiceModel.findOne({ sourceReceiptId: String(receipt._id) }).lean()) as
    | { _id: string }
    | null;
}

/**
 * Brings the order in line with the settlement.
 *
 * `paymentStatus` is written here as well as by the callers that claim the order atomically
 * before calling in. That repetition is deliberate: it is the same value, so re-writing it
 * costs nothing, and it means a caller that settles paperwork for an order it did not claim
 * itself — `/api/invoices/[id]/settle` — needs no separate update of its own.
 */
async function syncOrder(params: {
  orderId: string;
  receiptId: string;
  invoiceId: string;
  method: string;
  transactionId?: string;
  walletTransactionId?: string;
  walletType?: "store" | "business";
  walletAmount?: number;
  actor?: HistoryActor;
  at: Date;
}): Promise<void> {
  const actor = params.actor ?? SYSTEM_ACTOR;
  const paymentMethod = orderPaymentMethodFor(params.method, params.walletType);

  await Order.findByIdAndUpdate(params.orderId, {
    $set: {
      paymentStatus: "Paid",
      invoiceId: params.invoiceId,
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(params.transactionId ? { transactionId: params.transactionId } : {}),
      ...(params.walletTransactionId ? { walletTransactionId: params.walletTransactionId } : {}),
      ...(params.walletType ? { walletType: params.walletType } : {}),
      ...(params.walletAmount !== undefined ? { walletAmount: params.walletAmount } : {}),
    },
    $push: {
      history: {
        $each: [
          buildHistoryEvent({
            status: "Payment Received",
            actor,
            customerNote: "Payment received. Your tax invoice is available.",
            internalNote: `Receipt ${params.receiptId} settled via ${params.method}; invoice ${params.invoiceId} issued.`,
            at: params.at,
          }),
        ],
        $position: 0,
      },
    },
  });
}
