import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { verifyPaymentSignature, settleOrderPayment, type SettledOrderSummary } from "@/lib/razorpayPayment";
import { dispatchEvent } from "@/lib/events/eventDispatcher";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";

/**
 * Verifies a Razorpay checkout callback and settles the order.
 *
 * Previously this route only reported whether a signature was valid and left the caller
 * to act on it — and nothing ever called it, so paid orders stayed "Pending" forever.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await request.json();

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required Razorpay verification fields" },
        { status: 400 }
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_secret) {
      console.error("Razorpay secret key is missing.");
      return NextResponse.json({ error: "Payment gateway configuration error" }, { status: 500 });
    }

    const signatureValid = verifyPaymentSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
      keySecret: key_secret,
    });

    if (!signatureValid) {
      console.warn(`[Razorpay] Invalid signature for order ${orderId}`);
      return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
    }

    const result = await settleOrderPayment({
      orderId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      source: "checkout",
    });

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (result.status === "order_mismatch") {
      console.warn(`[Razorpay] Order mismatch: ${razorpay_order_id} does not belong to ${orderId}`);
      return NextResponse.json({ error: "Payment does not belong to this order" }, { status: 400 });
    }

    // Only announce a transition, never a replay.
    if (result.status === "settled") {
      try {
        await dbConnect();
        const order = await Order.findById(orderId).lean() as SettledOrderSummary | null;
        const email = order?.shippingAddress?.email || "";
        const customerId = email
          ? (await Customer.findOne({ email: email.toLowerCase() }).select("_id"))?._id || ""
          : "";

        dispatchEvent({
          eventType: "PAYMENT_STATUS_CHANGED",
          category: "payments",
          actor: { id: "SYSTEM", name: "Razorpay", role: "system" },
          recipient: { customerId: String(customerId), email, name: order?.customerName, role: "both" },
          entity: { type: "order", id: orderId },
          data: { ...order, paymentStatus: "Paid" },
        });
      } catch (err) {
        console.error("Failed to dispatch PAYMENT_STATUS_CHANGED:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      transactionId: razorpay_payment_id,
      alreadyProcessed: result.status === "already_paid",
    });
  } catch (error: unknown) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json({ error: "Internal server error during verification" }, { status: 500 });
  }
}
