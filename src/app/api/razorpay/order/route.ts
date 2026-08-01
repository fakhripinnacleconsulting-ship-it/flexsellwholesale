import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { requireAuth } from "@/lib/authGuard";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";

/**
 * Mints a Razorpay order for an existing FlexSell order.
 *
 * The amount is read from the order document, never from the request — a client-supplied
 * amount here would let a buyer pay ₹1 for a ₹10,000 order.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    const { orderId, currency = "INR" } = await request.json();

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
      console.error("Razorpay keys are missing from environment variables.");
      return NextResponse.json({ error: "Payment gateway configuration error" }, { status: 500 });
    }

    await dbConnect();
    const order = await Order.findById(orderId) as any;
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Only the buyer who owns the order (or an admin) may start a payment for it.
    const ownsOrder =
      order.customerId === payload.userId || order.shippingAddress?.email?.toLowerCase() === payload.email.toLowerCase();
    if (payload.role !== "admin" && !ownsOrder) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (order.paymentStatus === "Paid") {
      return NextResponse.json({ error: "This order is already paid" }, { status: 400 });
    }

    const amount = Number(order.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Order has no payable amount" }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id, key_secret });

    const rzpOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency,
      receipt: order._id as string,
      notes: { flexsellOrderId: order._id as string },
    });

    // Bind the Razorpay handle to this order so verification can confirm the callback
    // belongs to it and not to some other, cheaper payment.
    order.razorpayOrderId = rzpOrder.id;
    await order.save();

    return NextResponse.json({
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
    });
  } catch (error: unknown) {
    console.error("Razorpay order creation error:", error);
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
  }
}
