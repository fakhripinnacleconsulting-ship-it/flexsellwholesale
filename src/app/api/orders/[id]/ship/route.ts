import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { requireAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
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

    const timestamp = new Date().toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const carrierInfo = shipmentDetails.type === "self" 
      ? "local transport (Self)" 
      : `${shipmentDetails.carrierName} courier`;

    const newEvent = {
      status: "Shipped",
      timestamp,
      description: `Shipment dispatched and handed over to ${carrierInfo}. Tracking ID: ${shipmentDetails.trackingId}`
    };

    order.status = "Shipped";
    order.statusClass = ORDER_STATUS_CLASSES["Shipped"];
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
