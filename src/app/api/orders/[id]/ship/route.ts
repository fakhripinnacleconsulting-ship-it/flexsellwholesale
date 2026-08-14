import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { requireAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
import { actorLabel, buildHistoryEvent, orderStatusNotes, resolveActor } from "@/lib/orderHistory";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";

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
    const shipmentDetails = await request.json();

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const access = await verifyManagerOrderAccess(payload, order);
    if (access.error) return access.error;

    const carrierInfo = shipmentDetails.type === "self"
      ? "local transport (Self)"
      : `${shipmentDetails.carrierName} courier`;

    const shipActor = resolveActor(payload, access.manager?.name);

    /**
     * Amending an existing dispatch rather than creating one.
     *
     * The stepper is an append-only record, so an edit must never rewrite or remove the
     * original Shipped entry — and it must not force the status back to "Shipped" either.
     * Doing that on an order already marked In Transit or Delivered would rewind its
     * progress, which is precisely what the previous single code path did.
     */
    const isEdit = shipmentDetails.isEdit === true && !!order.shipmentDetails;
    // Never let a client-supplied flag reach the stored document.
    delete shipmentDetails.isEdit;

    // Fulfilment is final once the order is delivered or cancelled. The UI hides the Edit
    // button in those states, but the check belongs here so a stale tab or a direct API
    // call cannot rewrite a closed shipment.
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return NextResponse.json(
        {
          message: `This order is already marked ${order.status}. Its fulfilment details can no longer be changed.`,
        },
        { status: 409 }
      );
    }

    let newEvent;
    if (isEdit) {
      const previous = order.shipmentDetails;
      const changes: string[] = [];
      if (previous.type !== shipmentDetails.type) changes.push(`method ${previous.type} to ${shipmentDetails.type}`);
      if ((previous.carrierName || "") !== (shipmentDetails.carrierName || "")) {
        changes.push(`carrier to ${shipmentDetails.carrierName || "none"}`);
      }
      if (previous.trackingId !== shipmentDetails.trackingId) {
        changes.push(`tracking ID to ${shipmentDetails.trackingId}`);
      }
      if ((previous.estimatedDelivery || "") !== (shipmentDetails.estimatedDelivery || "")) {
        changes.push(`estimated delivery to ${shipmentDetails.estimatedDelivery}`);
      }

      newEvent = buildHistoryEvent({
        status: order.status,
        actor: shipActor,
        customerNote: `Your shipment details were updated by FlexSell Wholesale.${shipmentDetails.trackingId ? ` Tracking ID: ${shipmentDetails.trackingId}` : ""}`,
        internalNote: `Fulfilment details modified by ${actorLabel(shipActor)}${changes.length ? `: ${changes.join(", ")}.` : "."}`,
      });
    } else {
      // First dispatch — this is what actually moves the order to Shipped.
      newEvent = buildHistoryEvent({
        status: "Shipped",
        actor: shipActor,
        ...orderStatusNotes("Shipped", shipActor, {
          carrier: carrierInfo,
          trackingId: shipmentDetails.trackingId,
        }),
      });
      order.status = "Shipped";
      order.statusClass = ORDER_STATUS_CLASSES["Shipped"];
    }

    order.shipmentDetails = shipmentDetails;
    order.history.unshift(newEvent);

    await order.save();

    // Dispatch Centralized Event (Triggers Email & Notifications)
    try {
      const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
      const customerEmail = order.shippingAddress?.email || "";
      const customerName = order.customerName || order.shippingAddress?.name || "Valued Customer";
      const targetCustomerId = (await Customer.findOne({ email: customerEmail.toLowerCase() }).select("_id"))?._id || "";

      dispatchEventServer({
        eventType: "ORDER_SHIPPED",
        category: "shipments",
        actor: { id: payload.userId, name: payload.role === "admin" ? "Admin" : (payload.email || "Staff"), role: (payload.role as "admin" | "manager" | "customer" | "system") || "manager" },
        recipient: { customerId: targetCustomerId, email: customerEmail, name: customerName, role: "both" },
        entity: { type: "order", id: order._id },
        data: {
          order: order.toObject ? order.toObject() : order,
          carrierName: shipmentDetails.type === "self" ? "Local Transport (Self)" : shipmentDetails.carrierName,
          trackingId: shipmentDetails.trackingId,
          trackingUrl: shipmentDetails.trackingUrl,
          shipmentDetails
        }
      });
    } catch (err) {
      console.error("Failed to dispatch ORDER_SHIPPED event:", err);
    }

    // Dispatch Webhook & Notification asynchronously
    const targetCustomerId = (await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id"))?._id || "";
    dispatchWebhook("order.status_updated", order, targetCustomerId, {
      title: "Order Dispatched / Shipped",
      message: `Your wholesale order ${order._id} has been dispatched. Carrier: ${carrierInfo}. Tracking ID: ${shipmentDetails.trackingId}`,
      type: "order"
    }).catch(console.error);

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to ship order" }, { status: 500 });
  }
}
