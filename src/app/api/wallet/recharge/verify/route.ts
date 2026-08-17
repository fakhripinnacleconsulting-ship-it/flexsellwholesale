import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletTransaction from "@/models/WalletTransaction";
import { requireAuth } from "@/lib/authGuard";
import { verifyPaymentSignature } from "@/lib/razorpayPayment";
import { settleWalletRecharge } from "@/lib/walletRecharge";
import { toRupees } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * The browser callback after Razorpay Checkout closes.
 *
 * Not the authority on payment — the webhook is — but it makes the balance appear
 * immediately instead of up to a minute later. Both call the same idempotent settlement,
 * so whichever arrives first wins and the other is a no-op.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ message: "Incomplete payment confirmation" }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json({ message: "Payment gateway configuration error" }, { status: 500 });
    }

    // The signature is what proves this callback came from Razorpay and not from the page.
    if (
      !verifyPaymentSignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        signature: razorpay_signature,
        keySecret: secret,
      })
    ) {
      return NextResponse.json({ message: "Invalid payment signature" }, { status: 400 });
    }

    await dbConnect();

    const pending = await WalletTransaction.findOne({
      "metadata.razorpayOrderId": razorpay_order_id,
    })
      .select("userId amount status")
      .lean() as { userId?: string; amount?: number; status?: string } | null;

    if (!pending) {
      return NextResponse.json({ message: "Recharge not found" }, { status: 404 });
    }

    /**
     * A valid signature proves Razorpay sent it; it does not prove the caller owns the
     * recharge. Without this check one customer could settle another's pending payment.
     *
     * Admins are allowed through because they may start a top-up on a customer's behalf, and
     * whoever opened the checkout is the one whose browser receives the callback.
     */
    const isAdmin = payload.role === "admin";
    if (!isAdmin && pending.userId !== payload.userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const settlement = await settleWalletRecharge({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      // The stored amount is authoritative; passing it here keeps the mismatch guard
      // meaningful when the webhook has not run yet.
      capturedPaise: Number(pending.amount || 0),
      source: "callback",
    });

    if (settlement.status === "credited") {
      return NextResponse.json(
        {
          message: "Wallet credited",
          transactionId: settlement.transactionId,
          balance: toRupees(settlement.balancePaise),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (settlement.status === "already_settled") {
      return NextResponse.json(
        { message: "Already credited", transactionId: settlement.transactionId },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json({ message: "Could not credit this recharge" }, { status: 409 });
  } catch (error: unknown) {
    console.error("[Wallet] Recharge verify failed:", error);
    return NextResponse.json({ message: "Failed to confirm recharge" }, { status: 500 });
  }
}
