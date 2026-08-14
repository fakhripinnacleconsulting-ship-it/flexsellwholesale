import { formatDateTimeIST } from "@/lib/datetime";
import crypto from "crypto";

/**
 * Razorpay signature verification and payment settlement.
 *
 * Both the browser callback (`/api/razorpay/verify`) and the Razorpay webhook funnel
 * through `settleOrderPayment` so a payment lands exactly once, whichever arrives first.
 */

/** Constant-time compare that tolerates length mismatch without throwing. */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Verifies the checkout callback signature: HMAC-SHA256(order_id|payment_id, key_secret). */
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = crypto
    .createHmac("sha256", params.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest("hex");
  return safeEquals(expected, params.signature);
}

/** Verifies a webhook body signature: HMAC-SHA256(rawBody, webhookSecret). */
export function verifyWebhookSignature(rawBody: string, signature: string, webhookSecret: string): boolean {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEquals(expected, signature);
}

/** The order fields the payment-notification event needs. */
export interface SettledOrderSummary {
  _id: string;
  customerName?: string;
  amount?: number;
  shippingAddress?: { email?: string };
  [key: string]: unknown;
}

export type SettleResult =
  | { status: "settled"; orderId: string }
  | { status: "already_paid"; orderId: string }
  | { status: "not_found" }
  | { status: "order_mismatch" }
  | { status: "cancelled"; orderId: string };

/**
 * Marks an order paid and promotes its receipt to a tax invoice.
 *
 * Idempotent: a second call for an already-paid order is a no-op, so the webhook and the
 * browser callback racing each other cannot double-apply or double-notify.
 */
export async function settleOrderPayment(params: {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  /** Where the confirmation came from — recorded in the order history. */
  source: "checkout" | "webhook";
}): Promise<SettleResult> {
  const dbConnect = (await import("@/lib/dbConnect")).default;
  const Order = (await import("@/models/Order")).default;
  const InvoiceModel = (await import("@/models/Invoice")).default;

  await dbConnect();

  const order = await Order.findById(params.orderId) as any;
  if (!order) return { status: "not_found" };

  // The callback must refer to the Razorpay order we minted for THIS order, otherwise a
  // valid signature from a cheaper payment could be replayed to settle an expensive one.
  //
  // An order with no razorpayOrderId never had a payment started against it, so there is
  // nothing a genuine callback could be referring to — treat that as a mismatch too rather
  // than letting the check pass by default.
  if (!order.razorpayOrderId || order.razorpayOrderId !== params.razorpayOrderId) {
    return { status: "order_mismatch" };
  }

  if (order.paymentStatus === "Paid") {
    return { status: "already_paid", orderId: order._id as string };
  }

  // A cancelled order has already had its stock credited back. Marking it paid now would
  // let the same units be sold twice, so refuse and make the money loud instead of silent —
  // this needs a human to refund or re-place the order.
  if (order.status === "Cancelled") {
    console.error(
      `[Razorpay] Payment ${params.razorpayPaymentId} received for CANCELLED order ${order._id} ` +
      `(via ${params.source}). Stock was already restored — refund or re-create the order manually.`
    );
    return { status: "cancelled", orderId: order._id as string };
  }

  order.paymentStatus = "Paid";
  order.transactionId = params.razorpayPaymentId;
  order.history.unshift({
    status: order.status,
    timestamp: formatDateTimeIST(new Date()),
    description: `Online payment verified via Razorpay (${params.source}). Txn ID: ${params.razorpayPaymentId}`,
  });
  await order.save();

  // A pending receipt becomes a tax invoice once payment clears.
  const linkedInvoice = await InvoiceModel.findOne({ orderId: order._id }) as any;
  if (linkedInvoice) {
    linkedInvoice.type = "invoice";
    linkedInvoice.status = "paid";
    linkedInvoice.paymentStatus = "Paid";
    linkedInvoice.transactionId = params.razorpayPaymentId;
    await linkedInvoice.save();
  }

  return { status: "settled", orderId: order._id as string };
}
