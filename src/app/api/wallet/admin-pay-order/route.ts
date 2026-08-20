import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { requireWalletSpendAccess } from "@/lib/walletGuard";
import { rateLimit } from "@/lib/rateLimit";
import { toPaise, toRupees } from "@/lib/money";
import { InsufficientBalanceError } from "@/lib/walletLedger";
import { reserveWalletFunds, captureWalletFunds, refundWalletOrder } from "@/lib/walletCheckout";
import { settleOrderDocuments } from "@/lib/orderSettlement";
import { revalidateAdminDashboard } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Pays for an existing order from the customer's Wallet on behalf of them by an Admin/Manager.
 *
 * This endpoint allows staff to settle an order using the customer's Store or Business Wallet.
 */
export async function POST(request: NextRequest) {
  try {
    const { orderId, clientRequestId, customerId, walletType } = await request.json();

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ message: "Order is required" }, { status: 400 });
    }
    if (!clientRequestId || typeof clientRequestId !== "string") {
      return NextResponse.json({ message: "Missing request id" }, { status: 400 });
    }
    if (!customerId || typeof customerId !== "string") {
      return NextResponse.json({ message: "Customer ID is required" }, { status: 400 });
    }
    if (walletType !== "store" && walletType !== "business") {
      return NextResponse.json({ message: "Invalid wallet type" }, { status: 400 });
    }

    /**
     * The permission is derived from `walletType`, so a `wallet_business` holder cannot reach
     * a Store Wallet by changing a field in the payload.
     *
     * A bare `role === "manager"` check was not enough: it let a manager holding *any*
     * permission — content, CMS, shipping — spend any customer's balance. Spending money is
     * gated on the exact wallet permission and nothing else.
     */
    const auth = await requireWalletSpendAccess(walletType);
    if (auth.error) return auth.error;
    const { payload, actor } = auth;

    try {
      await rateLimit(payload.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    await dbConnect();

    // `any` matches how every other route in this codebase handles an Order document; the
    // schema is untyped, and inventing a partial interface here would drift from it.
    const order: any = await Order.findById(orderId);
    if (!order) return NextResponse.json({ message: "Order not found" }, { status: 404 });

    // No ownership check needed as admin/manager is authorized to act on behalf of the customer
    // We just verify the target customer actually exists
    const customer = await Customer.findById(customerId).select("name").lean() as
      | { name?: string }
      | null;

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    // The wallet being charged must belong to the customer this order is for. Without this a
    // staff member could name any customerId and settle one buyer's order from another
    // buyer's balance.
    const orderCustomerId = order.customerId ? String(order.customerId) : undefined;
    if (orderCustomerId && orderCustomerId !== customerId) {
      return NextResponse.json(
        { message: "This order does not belong to the selected customer" },
        { status: 403 }
      );
    }

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

    let hold;
    try {
      hold = await reserveWalletFunds({
        userId: customerId,
        walletType: walletType as "store" | "business",
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
            requiredAmount: err.requiredAmount ?? toRupees(amountPaise),
            availableAmount: err.availableAmount,
            shortfallAmount: err.shortfallAmount,
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
            // Which wallet paid, kept alongside the method rather than encoded into it: the
            // method drives display and reporting, and collapsing both wallets into one
            // string is what made a failed Business Wallet payment un-retryable.
            walletType,
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

      /**
       * Issue the Tax Invoice.
       *
       * **The inner `catch` is load-bearing — do not merge it into the enclosing one**, for
       * the same reason as /api/wallet/pay-order: that handler refunds the capture, and the
       * money here has legitimately paid the order. A document that could not be written is
       * retried, never unwound into a refund.
       */
      try {
        await settleOrderDocuments({
          orderId,
          method: "Wallet",
          transactionId: captured.transactionId,
          walletTransactionId: captured.transactionId,
          walletType,
          actor,
        });
        revalidateAdminDashboard();
      } catch (docErr) {
        console.error(
          `[Wallet] Order ${orderId} is paid but its tax invoice could not be issued:`,
          docErr
        );
      }

      return NextResponse.json(
        {
          message: `Paid from ${walletType === "business" ? "Business Wallet" : "Store Wallet"}`,
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
