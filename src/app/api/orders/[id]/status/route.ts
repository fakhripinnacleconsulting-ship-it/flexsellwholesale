import { isAdvanceBalanceMethod } from "@/lib/advanceBalanceConstants";
import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { settleOrderDocuments } from "@/lib/orderSettlement";
import { requireAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { buildHistoryEvent, orderStatusNotes, resolveActor } from "@/lib/orderHistory";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const { id } = await params;
    const { status, paymentStatus, paymentMethod, transactionId } = await request.json();
    
    if (!status || !ORDER_STATUS_CLASSES[status as keyof typeof ORDER_STATUS_CLASSES]) {
      return NextResponse.json({ message: "Invalid order status" }, { status: 400 });
    }

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const access = await verifyManagerOrderAccess(payload, order);
    if (access.error) return access.error;

    if (paymentStatus === "Paid") {
      /**
       * A gateway payment cannot be recorded by hand.
       *
       * It either carries a verified signature or it did not happen. `/api/razorpay/verify`
       * and the webhook settle it themselves; accepting it here let anyone mark an order paid
       * by typing a plausible payment id, with no money moved and nothing to verify against.
       */
      if (paymentMethod === "Razorpay") {
        return NextResponse.json(
          {
            message:
              "An online gateway payment cannot be recorded by hand — the customer pays from their order page and it settles automatically.",
            code: "GATEWAY_SETTLES_ITSELF",
          },
          { status: 400 }
        );
      }

      /**
       * A Advance Balance is debited by the Advance Balance routes, which read a balance and write a ledger
       * entry. Naming it here would mark the order paid against money still in the wallet.
       */
      if (isAdvanceBalanceMethod(paymentMethod)) {
        return NextResponse.json(
          {
            message:
              "An Advance Balance payment must go through the payment action so the balance is actually debited.",
            code: "USE_WALLET_ROUTE",
          },
          { status: 400 }
        );
      }

      // Bank rails reconcile against a reference; cash and COD have none to give.
      const REFERENCE_REQUIRED = ["UPI", "Bank Transfer", "NEFT/RTGS", "Cheque"];
      if (REFERENCE_REQUIRED.includes(paymentMethod) && !String(transactionId || "").trim()) {
        return NextResponse.json(
          { message: `A transaction reference (UTR or receipt no.) is required for ${paymentMethod}.` },
          { status: 400 }
        );
      }
    }

    // The actor comes from the verified session, never from the request body — otherwise a
    // caller could label their own action as an administrator's.
    const actor = resolveActor(payload, access.manager?.name);
    const notes = orderStatusNotes(status, actor, {
      carrier: order.shipmentDetails?.carrierName,
      trackingId: order.shipmentDetails?.trackingId,
    });

    const newEvent = buildHistoryEvent({ status, actor, ...notes });

    order.status = status;
    order.statusClass = ORDER_STATUS_CLASSES[status as keyof typeof ORDER_STATUS_CLASSES];
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }
    if (paymentMethod) {
      order.paymentMethod = paymentMethod;
    }
    if (transactionId) {
      order.transactionId = transactionId;
    }
    order.history.unshift(newEvent); // Add to the beginning of the history logs

    await order.save();

    /**
     * Payment recorded on dispatch — issue the Tax Invoice for it.
     *
     * This block used to flip `type` on the linked receipt in place:
     *
     *     linkedInvoice.type = "invoice"; linkedInvoice.status = "paid";
     *
     * `Invoice._id` is an assigned String that MongoDB will not change, so every Tax Invoice
     * that produced kept its receipt number and the `INV-` counter never advanced — the same
     * GST Rule 46(b) fault that `/api/invoices/[id]/settle` and the Razorpay path were fixed
     * for. This was the last copy of it.
     *
     * `settleOrderDocuments` mints a real `INV-`, retains the receipt as the record of what
     * was collected, and links the two. It is idempotent, so re-saving a status on an
     * already-paid order issues nothing further.
     *
     * The paperwork must not fail the status change — the order is saved above and the money
     * is real. Log and let the invoice be reissued.
     */
    if (paymentStatus === "Paid") {
      try {
        await settleOrderDocuments({
          orderId: String(order._id),
          method: paymentMethod || order.paymentMethod || "Cash",
          transactionId: transactionId || undefined,
          actor,
        });
      } catch (docErr) {
        console.error(
          `[Orders] Order ${order._id} is marked paid but its tax invoice could not be issued:`,
          docErr
        );
      }
    }

    // Dispatch Centralized Event (Triggers Email & Notifications)
    try {
      const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
      const customerEmail = order.shippingAddress?.email || "";
      const customerName = order.customerName || order.shippingAddress?.name || "Valued Customer";
      const targetCustomerId = (await Customer.findOne({ email: customerEmail.toLowerCase() }).select("_id"))?._id || "";

      const eventTypeToDispatch = status === "Cancelled" ? "ORDER_CANCELLED" : status === "Shipped" ? "ORDER_SHIPPED" : "ORDER_STATUS_CHANGED";

      dispatchEventServer({
        eventType: eventTypeToDispatch,
        category: "orders",
        actor: { id: payload.userId, name: "Admin", role: "admin" },
        recipient: { customerId: targetCustomerId, email: customerEmail, name: customerName, role: "both" },
        entity: { type: "order", id: order._id },
        data: {
          order: order.toObject ? order.toObject() : order,
          status,
          paymentStatus: order.paymentStatus,
          carrierName: order.shipmentDetails?.carrierName || "Delivery Partner",
          trackingId: order.shipmentDetails?.trackingId || "N/A",
          trackingUrl: order.shipmentDetails?.trackingUrl
        }
      });
    } catch (err) {
      console.error("Failed to dispatch order status event:", err);
    }

    // Dispatch Webhook & Notification asynchronously
    const targetCustomerId = (await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id"))?._id || "";
    dispatchWebhook("order.status_updated", order, targetCustomerId, {
      title: `Order Status Updated: ${status}`,
      // Customer-facing message, so it uses the customer-safe note — never the internal
      // one, which names the admin or manager who acted.
      message: `Your wholesale order ${order._id} status has been updated to ${status}. ${notes.customerNote}`,
      type: status === "Cancelled" ? "warning" : status === "Delivered" ? "success" : "info"
    }).catch(console.error);

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update order status" }, { status: 500 });
  }
}
