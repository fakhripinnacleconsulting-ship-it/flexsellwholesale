import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Manager from "@/models/Manager";
import { requireAuth } from "@/lib/authGuard";
import { requireAdvanceBalanceSpendAccess } from "@/lib/advanceBalanceGuard";
import { rateLimit } from "@/lib/rateLimit";
import { toPaise, toRupees } from "@/lib/money";
import { InsufficientBalanceError } from "@/lib/advanceBalanceLedger";
import { reserveAdvanceBalanceFunds, captureAdvanceBalanceFunds, refundAdvanceBalanceOrder } from "@/lib/advanceBalanceCheckout";
import { issueTaxInvoiceForReceipt, type StoredReceipt } from "@/lib/orderSettlement";
import { METHOD_TO_WALLET_TYPE } from "@/lib/advanceBalanceConstants";
import { resolveActor } from "@/lib/orderHistory";
import type { AdvanceBalanceActor } from "@/types/advanceBalance";

export const dynamic = "force-dynamic";

/**
 * Records payment against a receipt and issues the Tax Invoice for it.
 *
 * **The only route permitted to mark a document paid, and the only route permitted to mint an
 * `INV-` number.** Both rules exist because of the same two bugs:
 *
 *   1. `PUT /api/invoices/[id]` used to accept `{ paymentStatus: "Paid", paymentMethod:
 *      "Store Advance Balance" }` and write it through untouched. No balance was read and no ledger
 *      entry was written, so a customer with ₹0 could have a receipt marked Paid. The Advance Balance
 *      dropdown in the UI was purely decorative.
 *
 *   2. The same route converted the receipt by flipping `type` on the existing document.
 *      `Invoice._id` is an assigned String (`REC-01001`) and MongoDB will not change an
 *      `_id`, so every resulting "Tax Invoice" kept its receipt number and the `INV-` counter
 *      never advanced — GST Rule 46(b) requires a consecutive serial unique to the invoice
 *      series, which that design made impossible.
 *
 * So: money moves first and through the Advance Balance engine, then a **separate** `INV-` document is
 * created and the receipt is retained, marked paid, and linked to it.
 *
 * That last sequence now lives in `lib/orderSettlement.ts` and is shared with the Advance Balance and
 * Razorpay routes, which each used to get it wrong in their own way. This route keeps what is
 * genuinely its own: the authorisation, the Advance Balance spend guard, the money movement, and the
 * receipt pre-checks that turn a bad request into a specific status code.
 */

/**
 * Accepts the current wording and the wording it replaced — see METHOD_TO_WALLET_TYPE.
 * A receipt raised before the rename still names `"Store Advance Balance"`, and refusing it here would
 * make those receipts unsettleable.
 */
const WALLET_METHOD_TO_TYPE = METHOD_TO_WALLET_TYPE;

/**
 * Methods a human may record by hand.
 *
 * **Razorpay is deliberately absent.** A gateway payment is not something staff can attest
 * to — it either carries a verified signature or it did not happen. Accepting it here let
 * anyone type a plausible-looking payment id and turn a receipt into a paid Tax Invoice with
 * no money moved and nothing to verify against. The gateway settles itself through
 * `/api/razorpay/verify` and the webhook, both of which call `settleOrderDocuments` directly
 * and never pass through this route, so nothing legitimate is lost by refusing it.
 */
const NON_WALLET_METHODS = ["Cash", "UPI", "Bank Transfer", "NEFT/RTGS", "Cheque"];

/**
 * Methods that carry a reference the payment can be reconciled against.
 *
 * Cash is not one of them. A note handed over the counter has no UTR, so demanding one just
 * moves the fabrication from the code to the person — this route used to invent
 * `CASH-HAND-${Date.now()}` itself, and a hand-typed "CASH-1" is the same unreconcilable
 * string with a different author. The cash book is the record for cash.
 */
const METHODS_REQUIRING_REFERENCE = ["UPI", "Bank Transfer", "NEFT/RTGS", "Cheque"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let capturedTxId: string | undefined;
  let capturedWalletType: "store" | "business" | undefined;
  let advanceBalanceActor: AdvanceBalanceActor | undefined;

  try {
    const { id } = await params;
    const body = await request.json();
    const { method, transactionId, clientRequestId, notes } = body as {
      method?: string;
      transactionId?: string;
      clientRequestId?: string;
      notes?: string;
    };

    if (!method || typeof method !== "string") {
      return NextResponse.json({ message: "A payment method is required" }, { status: 400 });
    }

    const walletType = WALLET_METHOD_TO_TYPE[method];
    const isWallet = Boolean(walletType);

    if (!isWallet && !NON_WALLET_METHODS.includes(method)) {
      return NextResponse.json({ message: `Unsupported payment method "${method}"` }, { status: 400 });
    }

    /**
     * A reference is mandatory only where one actually exists — see
     * METHODS_REQUIRING_REFERENCE. A Advance Balance is exempt because the ledger entry is the
     * reference, and cash because there is nothing to quote.
     */
    if (METHODS_REQUIRING_REFERENCE.includes(method) && !String(transactionId || "").trim()) {
      return NextResponse.json(
        { message: `A transaction reference (UTR or receipt no.) is required for ${method}.` },
        { status: 400 }
      );
    }

    // Minted when the modal opens, so a double-click or a retried request settles once.
    if (!clientRequestId || typeof clientRequestId !== "string") {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 });
    }

    // 1. Authorise the document action.
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    if (payload.role !== "admin" && payload.role !== "manager") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    try {
      await rateLimit(payload.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    await dbConnect();

    if (payload.role === "manager") {
      const managerDoc = (await Manager.findById(payload.userId).lean()) as
        | { permissions?: string[]; status?: string }
        | null;
      if (!managerDoc || managerDoc.status !== "active") {
        return NextResponse.json({ message: "Forbidden: Account inactive or not found" }, { status: 403 });
      }
      const perms = managerDoc.permissions || [];
      /**
       * Exact action match — a `:read` grant must not authorise collecting money.
       *
       * `invoices_invoice` is accepted alongside the receipt grant because settling a receipt
       * *is* issuing a Tax Invoice, and the prepaid Tax Invoice flow in the create modal ends
       * here. Without it a manager could create the receipt that flow posts and then be
       * refused the settlement that gives it its `INV-` number.
       *
       * The Advance Balance grant is checked separately further down and is not implied by either.
       */
      const canSettle =
        perms.includes("invoices_receipt") ||
        perms.includes("invoices_receipt:update") ||
        perms.includes("invoices_invoice") ||
        perms.includes("invoices_invoice:create");
      if (!canSettle) {
        return NextResponse.json(
          { message: "Forbidden: Insufficient permissions to record a payment" },
          { status: 403 }
        );
      }
    }

    const receipt = (await InvoiceModel.findById(id).lean()) as StoredReceipt | null;
    if (!receipt) {
      return NextResponse.json({ message: "Document not found" }, { status: 404 });
    }
    if (receipt.type !== "receipt") {
      return NextResponse.json(
        { message: "Only a receipt can be settled into a Tax Invoice." },
        { status: 400 }
      );
    }
    if (receipt.status === "paid" || receipt.settledByInvoiceId) {
      return NextResponse.json(
        { message: "This receipt has already been paid.", invoiceId: receipt.settledByInvoiceId },
        { status: 409 }
      );
    }
    if (receipt.status === "cancelled" || receipt.status === "refunded") {
      return NextResponse.json(
        { message: `A ${receipt.status} receipt cannot be settled.` },
        { status: 409 }
      );
    }

    const existingInvoice = await InvoiceModel.findOne({ sourceReceiptId: id }).select("_id").lean();
    if (existingInvoice) {
      return NextResponse.json(
        { message: "An invoice has already been issued for this receipt.", invoiceId: (existingInvoice as { _id: string })._id },
        { status: 409 }
      );
    }

    /**
     * The amount comes from the stored receipt, never from the request — the same protection
     * the Razorpay and Advance Balance checkout paths already rely on.
     */
    const amountPaise = toPaise(Number(receipt.amount) || 0);
    if (amountPaise <= 0) {
      return NextResponse.json({ message: "This receipt has no payable amount" }, { status: 400 });
    }

    // 2. Move the money — before anything is marked paid.
    let settlementTransactionId = String(transactionId || "").trim();

    if (isWallet) {
      const customerId = receipt.customerId ? String(receipt.customerId) : "";
      if (!customerId) {
        return NextResponse.json(
          { message: "This receipt is not linked to a customer account, so no Advance Balance can be charged." },
          { status: 400 }
        );
      }

      /**
       * A document permission never implies a Advance Balance permission.
       *
       * `invoices_receipt:update` authorises issuing the invoice; spending someone's balance
       * needs the exact `wallet_store` / `wallet_business` grant, checked separately here.
       * The permission is derived from the method, so the request body cannot select it.
       */
      const advanceBalanceAuth = await requireAdvanceBalanceSpendAccess(walletType);
      if (advanceBalanceAuth.error) return advanceBalanceAuth.error;
      advanceBalanceActor = advanceBalanceAuth.actor;
      capturedWalletType = walletType;

      let hold;
      try {
        hold = await reserveAdvanceBalanceFunds({
          userId: customerId,
          walletType,
          amountPaise,
          actor: advanceBalanceActor,
          clientRequestId,
          orderLabel: `Receipt ${id}`,
        });
      } catch (err) {
        if (err instanceof InsufficientBalanceError) {
          /**
           * Name the shortfall. "Insufficient balance" only tells someone to go and look.
           *
           * `err.message` now carries the figures, and they are repeated as fields so the UI
           * can format them itself rather than parsing the sentence.
           */
          return NextResponse.json(
            {
              message: err.message,
              code: "INSUFFICIENT_BALANCE",
              walletType,
              requiredAmount: err.requiredAmount ?? toRupees(amountPaise),
              availableAmount: err.availableAmount,
              shortfallAmount: err.shortfallAmount,
            },
            { status: 409 }
          );
        }
        throw err;
      }

      const captured = await captureAdvanceBalanceFunds({ holdId: hold.holdId, orderId: receipt.orderId || id });
      if (!captured) {
        // The hold was released underneath us — almost certainly the sweeper. Nothing was
        // taken, so ask for a retry rather than reporting a payment that did not happen.
        return NextResponse.json(
          { message: "This payment expired. Please try again." },
          { status: 409 }
        );
      }

      capturedTxId = captured.transactionId;
      settlementTransactionId = captured.transactionId;
    }

    // 3. Issue the invoice, retain the receipt, sync the order — the shared sequence.
    const { invoiceId, invoice } = await issueTaxInvoiceForReceipt({
      receipt,
      method,
      // Empty for a cash payment, which carries no reference — store nothing rather than an
      // empty string masquerading as one.
      transactionId: settlementTransactionId || undefined,
      walletTransactionId: capturedTxId,
      walletType: capturedWalletType,
      walletAmount: capturedTxId ? toRupees(amountPaise) : undefined,
      notes,
      actor: resolveActor(payload),
    });

    return NextResponse.json(
      {
        message: `Payment recorded. Tax Invoice ${invoiceId} issued.`,
        invoiceId,
        receiptId: id,
        transactionId: settlementTransactionId,
        invoice,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    /**
     * The Advance Balance was charged but the invoice could not be issued — the one case where the
     * customer would otherwise be poorer with nothing to show for it. Return the money and
     * let them retry; a duplicated payment is far worse than a repeated settlement.
     *
     * Mirrors the compensation in /api/advance-balance/pay-order deliberately: one shape, one place
     * to reason about, so the two cannot drift.
     */
    if (capturedTxId && advanceBalanceActor) {
      await refundAdvanceBalanceOrder({
        walletTransactionId: capturedTxId,
        orderId: "settlement-failed",
        actor: advanceBalanceActor,
        reason: "invoice_issue_failed",
      }).catch((refundErr) =>
        console.error("[Settle] Failed to refund Advance Balance after a failed invoice issue:", refundErr)
      );
    }

    console.error("[Settle] Receipt settlement failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to record the payment" },
      { status: 500 }
    );
  }
}
