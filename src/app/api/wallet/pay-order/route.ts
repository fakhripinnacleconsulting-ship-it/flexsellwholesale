import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { requireAuth } from "@/lib/authGuard";
import { resolveActor } from "@/lib/orderHistory";
import { toPaise, toRupees } from "@/lib/money";
import { InsufficientBalanceError } from "@/lib/walletLedger";
import { reserveWalletFunds, captureWalletFunds, releaseWalletFunds, refundWalletOrder } from "@/lib/walletCheckout";
import type { WalletActor } from "@/types/wallet";

export const dynamic = "force-dynamic";

/**
 * Pays for an existing order from the customer's Store Wallet.
 *
 * The **customer-facing** entry point, and it accepts the Store Wallet only. The Business
 * Wallet is services-only from the customer's side; staff placing an order on someone's
 * behalf use a different route, so the two rules live in two endpoints rather than in one
 * with a role check buried inside it.
 *
 * The amount comes from the stored order, never the request — the same protection the
 * Razorpay path already relies on.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    if (payload.role !== "customer") {
      return NextResponse.json(
        { message: "Only the account holder can pay from their own wallet here" },
        { status: 403 }
      );
    }

    const { orderId, clientRequestId } = await request.json();

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ message: "Order is required" }, { status: 400 });
    }
    if (!clientRequestId || typeof clientRequestId !== "string") {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 });
    }

    await dbConnect();

    // `any` matches how every other route in this codebase handles an Order document; the
    // schema is untyped, and inventing a partial interface here would drift from it.
    const order: any = await Order.findById(orderId);
    if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });

    // A valid session does not prove ownership of this order.
    const ownsOrder =
      order.customerId === payload.userId ||
      order.shippingAddress?.email?.toLowerCase() === payload.email?.toLowerCase();
    if (!ownsOrder) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    if (order.paymentStatus === "Paid") {
      return NextResponse.json({ message: "This order is already paid" }, { status: 409 });
    }
    if (order.status === "Cancelled") {
      return NextResponse.json({ message: "This order has been cancelled" }, { status: 409 });
    }

    const amountPaise = toPaise(Number(order.amount) || 0);
    if (amountPaise <= 0) {
      return NextResponse.json({ message: "Order has no payable amount" }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId).select("name").lean() as
      | { name?: string }
      | null;
    const actor = resolveActor(payload, customer?.name) as WalletActor;

    let hold;
    try {
      hold = await reserveWalletFunds({
        userId: payload.userId,
        walletType: "store",
        amountPaise,
        actor,
        clientRequestId,
        orderLabel: `Order ${orderId}`,
      });
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        // Name the shortfall rather than saying "insufficient". A customer who is ₹2,300
        // short can act on that; "insufficient balance" only tells them to go and check.
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

    let capturedTxId: string | undefined;

    try {
      const captured = await captureWalletFunds({ holdId: hold.holdId, orderId });

      if (!captured) {
        // The hold was released underneath us — almost certainly the sweeper deciding the
        // checkout had been abandoned. Nothing has been taken, so ask for a retry.
        return NextResponse.json(
          { message: "This payment expired. Please try again." },
          { status: 409 }
        );
      }

      capturedTxId = captured.transactionId;

      // Atomically claim the order to prevent a double-click race condition from charging twice.
      // If two requests capture successfully, only one wins the update; the other refunds.
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, paymentStatus: { $ne: "Paid" }, status: { $ne: "Cancelled" } } as any,
        {
          $set: {
            paymentMethod: "Wallet",
            paymentStatus: "Paid",
            walletTransactionId: captured.transactionId,
            walletAmount: toRupees(amountPaise),
            transactionId: captured.transactionId,
          },
        },
        { new: true }
      );

      if (!updatedOrder) {
        throw new Error("Order was updated by another process, or is no longer eligible for payment.");
      }

      return NextResponse.json(
        {
          message: "Paid from your Store Wallet",
          orderId,
          transactionId: captured.transactionId,
          balance: toRupees(captured.balancePaise),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (err) {
      /**
       * Capture succeeded but the order could not be marked paid — the one case where the
       * customer would otherwise be charged for an order that still looks unpaid. Return
       * the money and make them retry; a duplicated payment is far worse than a repeated
       * checkout.
       * 
       * Because capture succeeded, we must use `refundWalletOrder` (which refunds a successful capture)
       * rather than `releaseWalletFunds` (which only releases pending holds).
       */
      if (capturedTxId) {
        await refundWalletOrder({
          walletTransactionId: capturedTxId,
          orderId,
          actor,
          reason: "order_update_failed",
        }).catch((refundErr) =>
          console.error("[Wallet] Failed to refund wallet after a failed order capture:", refundErr)
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("[Wallet] Order payment failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Could not pay from your wallet" },
      { status: 500 }
    );
  }
}
