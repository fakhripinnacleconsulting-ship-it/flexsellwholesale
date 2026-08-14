import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import InvoiceModel from "@/models/Invoice";
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

    // Sync Invoice details if payment is updated to Paid
    if (paymentStatus === "Paid") {
      const linkedInvoice = await InvoiceModel.findOne({ orderId: order._id });
      if (linkedInvoice) {
        linkedInvoice.type = "invoice";
        linkedInvoice.status = "paid";
        linkedInvoice.paymentStatus = "Paid";
        if (paymentMethod) linkedInvoice.paymentMethod = paymentMethod;
        if (transactionId) linkedInvoice.transactionId = transactionId;
        await linkedInvoice.save();
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
