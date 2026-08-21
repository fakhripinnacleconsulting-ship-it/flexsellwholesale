import { NextResponse } from "next/server";
import { verifyWebhookSignature, settleOrderPayment, type SettledOrderSummary } from "@/lib/razorpayPayment";
import { settleAdvanceBalanceTopUp } from "@/lib/advanceBalanceRecharge";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";

export const dynamic = "force-dynamic";

/**
 * Razorpay webhook — the safety net for payments the browser never confirmed.
 *
 * Without this, a buyer who closes the tab right after paying leaves an order stuck at
 * "Pending" while their money has already been captured. Shares `settleOrderPayment`
 * with the checkout callback, so whichever arrives first wins and the other is a no-op.
 *
 * Configure in the Razorpay dashboard: URL = /api/razorpay/webhook,
 * events = payment.captured, payment.failed. Set RAZORPAY_WEBHOOK_SECRET to match.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
      return NextResponse.json({ message: "Webhook not configured" }, { status: 500 });
    }

    // Signature is computed over the exact raw body — parse only after verifying.
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!signature || !verifyWebhookSignature(rawBody, signature, secret)) {
      console.warn("[Razorpay Webhook] Rejected: invalid signature");
      return NextResponse.json({ message: "Invalid webhook signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };

    const payment = event.payload?.payment?.entity;
    if (!payment) {
      return NextResponse.json({ message: "No payment entity in webhook payload" }, { status: 400 });
    }

    const razorpayOrderId = String(payment.order_id || "");
    const razorpayPaymentId = String(payment.id || "");
    // Set when we minted the Razorpay order; falls back to the receipt field.
    const notes = (payment.notes || {}) as Record<string, string>;
    const flexsellOrderId = notes.flexsellOrderId || String(payment.receipt || "");

    if (event.event === "payment.failed") {
      console.warn(`[Razorpay Webhook] Payment failed for order ${flexsellOrderId || razorpayOrderId}`);
      // Deliberately not cancelling the order here — the buyer may retry, and releasing
      // stock on every failed attempt would let a spammer empty the catalogue.
      return NextResponse.json({ message: "Payment failure acknowledged" });
    }

    if (event.event !== "payment.captured") {
      return NextResponse.json({ message: `Ignored event: ${event.event}` });
    }

    await dbConnect();

    /**
     * Advance Balance recharges settle here too.
     *
     * Deliberately a branch inside this route rather than a second webhook endpoint: this
     * one already verifies the signature over the raw body and is already exempt from CSRF.
     * A separate endpoint would mean rebuilding both, and getting either wrong on a route
     * that credits money is not a recoverable mistake.
     */
    /**
     * Both note keys, permanently.
     *
     * The note is attached to a Razorpay order when a top-up starts and comes back on the
     * webhook minutes later — so it lives in **Razorpay's** records, not ours. Any top-up
     * begun before the rename carries `flexsellWalletTxnId`; reading only the new key would
     * mean those payments are captured by Razorpay and never credited, leaving the customer
     * debited with no balance to show for it.
     *
     * This is not a transitional shim to delete later: a retried webhook can deliver an old
     * note at any point in the future.
     */
    const pendingTopUpId = notes.flexsellAdvanceBalanceTxnId || notes.flexsellWalletTxnId;

    if (pendingTopUpId) {
      const capturedPaise = Number(payment.amount || 0);
      const settlement = await settleAdvanceBalanceTopUp({
        razorpayOrderId,
        razorpayPaymentId,
        capturedPaise,
        source: "webhook",
      });

      if (settlement.status === "not_found") {
        return NextResponse.json({ message: "Wallet recharge not found" }, { status: 404 });
      }
      if (settlement.status === "amount_mismatch") {
        // 200 so Razorpay stops retrying — retrying will not fix a mismatch. The error is
        // logged inside settleAdvanceBalanceTopUp for manual review.
        return NextResponse.json({ message: "Amount mismatch; flagged for review" });
      }
      if (settlement.status === "already_settled") {
        return NextResponse.json({ message: "Already processed", walletTransactionId: settlement.transactionId });
      }
      return NextResponse.json({
        message: "Wallet credited",
        walletTransactionId: settlement.transactionId,
      });
    }

    // Prefer the id we stamped on the order; otherwise look it up by Razorpay handle.
    let orderId = flexsellOrderId;
    if (!orderId && razorpayOrderId) {
      const match = await Order.findOne({ razorpayOrderId }).select("_id").lean() as { _id?: string } | null;
      orderId = match?._id ? String(match._id) : "";
    }

    if (!orderId) {
      console.warn(`[Razorpay Webhook] No local order for Razorpay order ${razorpayOrderId}`);
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const result = await settleOrderPayment({
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      source: "webhook",
    });

    if (result.status === "not_found") {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }
    if (result.status === "order_mismatch") {
      return NextResponse.json({ message: "Payment does not belong to this order" }, { status: 400 });
    }
    if (result.status === "already_paid") {
      return NextResponse.json({ message: "Already processed", orderId });
    }
    if (result.status === "cancelled") {
      // 200 on purpose: the payment is genuine and Razorpay must not keep retrying. The
      // mismatch is logged inside settleOrderPayment for manual refund.
      return NextResponse.json({ message: "Order was cancelled; flagged for manual review", orderId });
    }

    try {
      const order = await Order.findById(orderId).lean() as SettledOrderSummary | null;
      const email = order?.shippingAddress?.email || "";
      const customerId = email
        ? (await Customer.findOne({ email: email.toLowerCase() }).select("_id"))?._id || ""
        : "";

      dispatchEventServer({
        eventType: "PAYMENT_STATUS_CHANGED",
        category: "payments",
        actor: { id: "SYSTEM", name: "Razorpay Webhook", role: "system" },
        recipient: { customerId: String(customerId), email, name: order?.customerName, role: "both" },
        entity: { type: "order", id: orderId },
        data: { ...order, paymentStatus: "Paid" },
      });
    } catch (err) {
      console.error("[Razorpay Webhook] Failed to dispatch payment event:", err);
    }

    return NextResponse.json({ message: "Payment settled", orderId });
  } catch (error: unknown) {
    console.error("[Razorpay Webhook] Exception:", error);
    return NextResponse.json({ message: "Internal webhook error" }, { status: 500 });
  }
}

