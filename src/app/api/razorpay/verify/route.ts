import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAuth } from "@/lib/authGuard";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required Razorpay verification fields" },
        { status: 400 }
      );
    }

    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_secret) {
      console.error("Razorpay secret key is missing.");
      return NextResponse.json(
        { error: "Payment gateway configuration error" },
        { status: 500 }
      );
    }

    const hmac = crypto.createHmac("sha256", key_secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generated_signature = hmac.digest("hex");

    if (generated_signature === razorpay_signature) {
      return NextResponse.json({
        success: true,
        message: "Payment verified successfully",
        transactionId: razorpay_payment_id,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid payment signature" },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json(
      { error: "Internal server error during verification" },
      { status: 500 }
    );
  }
}
