import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import { verifyPaymentSignature, settleOrderPayment, type SettledOrderSummary } from "@/lib/razorpayPayment";
import { dispatchEventServer } from "@/lib/events/eventDispatcherServer";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";

/**
 * Verifies a Razorpay checkout callback and settles the order it belongs to.
 *
 * Requires the FlexSell `orderId`: an earlier version treated it as optional, verified the
 * signature, settled nothing and still answered `success: true`, which is how captured
 * payments ended up on orders that stayed "Pending" forever.
 *
 * The Razorpay webhook is the backstop for a buyer who closes the tab mid-callback; both
 * paths funnel through `settleOrderPayment` so a payment lands exactly once.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required Razorpay verification fields" },
        { status: 400 }
      );
    }

    // Without an orderId this route used to verify the signature, settle nothing, and still
    // answer `success: true` — which is exactly what the checkout did, so paid orders were
    // left Pending. A verification that cannot name its order is not a verification.
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "orderId is required to settle a payment" },
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
      console.warn(`[Razorpay] Invalid signature for order ${orderId || razorpay_order_id}`);
      return NextResponse.json({ success: false, error: "Invalid payment signature" }, { status: 400 });
    }

    // The caller must own the order they are settling. The razorpay_order_id is already
    // bound to the order by /api/razorpay/order, but check the session too so a leaked
    // signature cannot be replayed against someone else's order by a third party.
    await dbConnect();
    const target = await Order.findById(orderId).select("customerId shippingAddress.email").lean() as
      | { customerId?: string; shippingAddress?: { email?: string } }
      | null;

    if (!target) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    /**
     * The buyer, or staff who collected the payment on their behalf.
     *
     * Managers were excluded here too, so a manager who ran a card at the counter could not
     * confirm it — the order stayed Pending until the webhook caught up. Staff are trusted
     * with the callback for the same reason they are trusted to start it: the signature is
     * what actually authorises the settlement, and it is checked above regardless of role.
     */
    const isStaff = auth.payload!.role === "admin" || auth.payload!.role === "manager";
    const ownsOrder =
      target.customerId === auth.payload!.userId ||
      target.shippingAddress?.email?.toLowerCase() === auth.payload!.email.toLowerCase();
    if (!isStaff && !ownsOrder) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let isAlreadyPaid = false;

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
    if (result.status === "cancelled") {
      return NextResponse.json(
        { error: "This order was cancelled. If you were charged, our team will refund you shortly." },
        { status: 409 }
      );
    }

    if (result.status === "already_paid") {
      isAlreadyPaid = true;
    } else if (result.status === "settled") {
      try {
        const order = await Order.findById(orderId).lean() as SettledOrderSummary | null;
        const email = order?.shippingAddress?.email || "";
        const customerId = email
          ? (await Customer.findOne({ email: email.toLowerCase() }).select("_id"))?._id || ""
          : "";

        const eventData = { ...order, paymentStatus: "Paid", status: "Processing" };

        dispatchEventServer({
          eventType: "ORDER_CREATED",
          category: "orders",
          actor: { id: "SYSTEM", name: "Razorpay", role: "system" },
          recipient: { customerId: String(customerId), email, name: order?.customerName, role: "both" },
          entity: { type: "order", id: orderId },
          data: eventData,
        });

        dispatchEventServer({
          eventType: "PAYMENT_STATUS_CHANGED",
          category: "payments",
          actor: { id: "SYSTEM", name: "Razorpay", role: "system" },
          recipient: { customerId: String(customerId), email, name: order?.customerName, role: "both" },
          entity: { type: "order", id: orderId },
          data: eventData,
        });
      } catch (err) {
        console.error("Failed to dispatch ORDER_CREATED / PAYMENT_STATUS_CHANGED:", err);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      transactionId: razorpay_payment_id,
      alreadyProcessed: isAlreadyPaid,
    });
  } catch (error: unknown) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json({ error: "Internal server error during verification" }, { status: 500 });
  }
}

