import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import InvoiceModel from "@/models/Invoice";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const { status, paymentStatus, paymentMethod, transactionId } = await request.json();
    
    if (!status || !ORDER_STATUS_CLASSES[status as keyof typeof ORDER_STATUS_CLASSES]) {
      return NextResponse.json({ message: "Invalid order status" }, { status: 400 });
    }

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    let description = `Order status updated to ${status}.`;
    if (status === "Processing") {
      description = "Order packaging and B2B validation completed.";
    } else if (status === "Delivered") {
      description = "Order cargo delivered safely to customer dock.";
    } else if (status === "Cancelled") {
      description = "Order has been cancelled by administrator.";
    }

    const newEvent = {
      status,
      timestamp: new Date().toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      description
    };

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

    // Dispatch Webhook & Notification asynchronously
    const targetCustomerId = (await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id"))?._id || "";
    dispatchWebhook("order.status_updated", order, targetCustomerId, {
      title: `Order Status Updated: ${status}`,
      message: `Your wholesale order ${order._id} status has been updated to ${status}. Description: ${description}`,
      type: status === "Cancelled" ? "warning" : status === "Delivered" ? "success" : "info"
    }).catch(console.error);

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update order status" }, { status: 500 });
  }
}
