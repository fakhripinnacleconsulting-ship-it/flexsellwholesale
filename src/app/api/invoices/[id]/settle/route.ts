import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import InvoiceModel from "@/models/Invoice";
import Order from "@/models/Order";
import Manager from "@/models/Manager";
import { requireAuth } from "@/lib/authGuard";
import { requireWalletSpendAccess } from "@/lib/walletGuard";
import { rateLimit } from "@/lib/rateLimit";
import { generateNextId } from "@/lib/idGeneratorServer";
import { formatDateIST, formatDateTimeIST } from "@/lib/datetime";
import { toPaise, toRupees } from "@/lib/money";
import { InsufficientBalanceError } from "@/lib/walletLedger";
import { reserveWalletFunds, captureWalletFunds, refundWalletOrder } from "@/lib/walletCheckout";
import { resolveActor } from "@/lib/orderHistory";
import type { WalletActor } from "@/types/wallet";

export const dynamic = "force-dynamic";

/**
 * Records payment against a receipt and issues the Tax Invoice for it.
 *
 * **The only route permitted to mark a document paid, and the only route permitted to mint an
 * `INV-` number.** Both rules exist because of the same two bugs:
 *
 *   1. `PUT /api/invoices/[id]` used to accept `{ paymentStatus: "Paid", paymentMethod:
 *      "Store Wallet" }` and write it through untouched. No balance was read and no ledger
 *      entry was written, so a customer with ₹0 could have a receipt marked Paid. The wallet
 *      dropdown in the UI was purely decorative.
 *
 *   2. The same route converted the receipt by flipping `type` on the existing document.
 *      `Invoice._id` is an assigned String (`REC-01001`) and MongoDB will not change an
 *      `_id`, so every resulting "Tax Invoice" kept its receipt number and the `INV-` counter
 *      never advanced — GST Rule 46(b) requires a consecutive serial unique to the invoice
 *      series, which that design made impossible.
 *
 * So: money moves first and through the wallet engine, then a **separate** `INV-` document is
 * created and the receipt is retained, marked paid, and linked to it.
 */

const WALLET_METHOD_TO_TYPE: Record<string, "store" | "business"> = {
  "Store Wallet": "store",
  "Business Wallet": "business",
};

const NON_WALLET_METHODS = ["Cash", "UPI", "Bank Transfer", "Razorpay", "NEFT/RTGS", "Cheque"];

/**
 * The stored receipt, as this route needs to read it.
 *
 * A partial shape rather than the full `Invoice`: the remaining fields are copied verbatim
 * onto the invoice without being inspected, so naming them here would only invite drift.
 */
interface StoredReceipt {
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let capturedTxId: string | undefined;
  let capturedWalletType: "store" | "business" | undefined;
  let walletActor: WalletActor | undefined;

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
     * A reference is mandatory for every non-wallet method.
     *
     * The pay modal used to invent one (`CASH-HAND-${Date.now().toString().slice(-4)}`) when
     * the field was left blank, which is worse than no reference: it looks like a real
     * receipt number in the ledger and reconciles against nothing.
     */
    if (!isWallet && !String(transactionId || "").trim()) {
      return NextResponse.json(
        { message: "A transaction reference (UTR, receipt no. or payment id) is required." },
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
      // Exact action match — a `:read` grant must not authorise collecting money.
      if (!perms.includes("invoices_receipt") && !perms.includes("invoices_receipt:update")) {
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
     * the Razorpay and wallet checkout paths already rely on.
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
          { message: "This receipt is not linked to a customer account, so no wallet can be charged." },
          { status: 400 }
        );
      }

      /**
       * A document permission never implies a wallet permission.
       *
       * `invoices_receipt:update` authorises issuing the invoice; spending someone's balance
       * needs the exact `wallet_store` / `wallet_business` grant, checked separately here.
       * The permission is derived from the method, so the request body cannot select it.
       */
      const walletAuth = await requireWalletSpendAccess(walletType);
      if (walletAuth.error) return walletAuth.error;
      walletActor = walletAuth.actor;
      capturedWalletType = walletType;

      let hold;
      try {
        hold = await reserveWalletFunds({
          userId: customerId,
          walletType,
          amountPaise,
          actor: walletActor,
          clientRequestId,
          orderLabel: `Receipt ${id}`,
        });
      } catch (err) {
        if (err instanceof InsufficientBalanceError) {
          // Name the shortfall. "Insufficient balance" only tells someone to go and look.
          return NextResponse.json(
            {
              message: err.message,
              code: "INSUFFICIENT_BALANCE",
              requiredAmount: toRupees(amountPaise),
            },
            { status: 409 }
          );
        }
        throw err;
      }

      const captured = await captureWalletFunds({ holdId: hold.holdId, orderId: receipt.orderId || id });
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

    // 3. Issue the invoice, retain the receipt, sync the order.
    const invoiceId = await generateNextId("invoice");
    const now = new Date();
    // The invoice carries the receipt's content, minus the fields it must mint fresh.
    const receiptFields: Record<string, unknown> = { ...receipt };
    for (const key of ["_id", "createdAt", "updatedAt", "sourceReceiptId", "settledByInvoiceId"]) {
      delete receiptFields[key];
    }

    const invoice = await InvoiceModel.create({
      ...receiptFields,
      _id: invoiceId,
      type: "invoice",
      status: "paid",
      paymentStatus: "Paid",
      paymentMethod: method,
      transactionId: settlementTransactionId,
      walletTransactionId: capturedTxId,
      walletType: capturedWalletType,
      // The link that makes double-settlement impossible: unique sparse index.
      sourceReceiptId: id,
      settledByInvoiceId: undefined,
      notes: notes !== undefined ? notes : receipt.notes,
      generatedAt: formatDateIST(now),
      issuedAt: now,
      // Mongoose cannot narrow a spread of the stored receipt against the schema type. The
      // spread fields are the receipt's own, already validated when it was created; the
      // fields that matter here are the explicit ones above.
    } as never);

    await InvoiceModel.findByIdAndUpdate(id, {
      $set: {
        status: "paid",
        paymentStatus: "Paid",
        paymentMethod: method,
        transactionId: settlementTransactionId,
        walletTransactionId: capturedTxId,
        walletType: capturedWalletType,
        settledByInvoiceId: invoiceId,
      },
    });

    if (receipt.orderId) {
      await Order.findByIdAndUpdate(receipt.orderId, {
        $set: {
          paymentStatus: "Paid",
          paymentMethod: isWallet ? "Wallet" : method === "Cash" ? "Cash" : method,
          transactionId: settlementTransactionId,
          ...(capturedTxId ? { walletTransactionId: capturedTxId, walletAmount: toRupees(amountPaise) } : {}),
          ...(capturedWalletType ? { walletType: capturedWalletType } : {}),
          invoiceId,
        },
        $push: {
          history: {
            $each: [
              {
                status: "Payment Received",
                at: now,
                timestamp: formatDateTimeIST(now),
                customerNote: "Payment received. Your tax invoice is available.",
                internalNote: `Receipt ${id} settled via ${method}; invoice ${invoiceId} issued.`,
                actor: resolveActor(payload),
              },
            ],
            $position: 0,
          },
        },
      });
    }

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
     * The wallet was charged but the invoice could not be issued — the one case where the
     * customer would otherwise be poorer with nothing to show for it. Return the money and
     * let them retry; a duplicated payment is far worse than a repeated settlement.
     *
     * Mirrors the compensation in /api/wallet/pay-order deliberately: one shape, one place
     * to reason about, so the two cannot drift.
     */
    if (capturedTxId && walletActor) {
      await refundWalletOrder({
        walletTransactionId: capturedTxId,
        orderId: "settlement-failed",
        actor: walletActor,
        reason: "invoice_issue_failed",
      }).catch((refundErr) =>
        console.error("[Settle] Failed to refund wallet after a failed invoice issue:", refundErr)
      );
    }

    console.error("[Settle] Receipt settlement failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to record the payment" },
      { status: 500 }
    );
  }
}
