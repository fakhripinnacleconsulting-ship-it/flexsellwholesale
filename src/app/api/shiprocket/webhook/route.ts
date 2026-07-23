import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { shiprocketClient } from "@/lib/shiprocketClient";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";

// Dedicated IP rate limiter for webhook (30 req/min) [UPDATED-3]
const webhookIpMap = new Map<string, { count: number; resetTime: number }>();
function checkWebhookRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 30;

  let record = webhookIpMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + windowMs };
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  webhookIpMap.set(ip, record);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // 1. IP Rate limit check
    const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown-ip";
    if (!checkWebhookRateLimit(clientIp)) {
      return NextResponse.json({ message: "Webhook rate limit exceeded" }, { status: 429 });
    }

    await dbConnect();
    const creds = await shiprocketClient.getCredentials();
    const expectedToken = creds.webhookToken || process.env.SHIPROCKET_WEBHOOK_TOKEN;

    // 2. Webhook Token Verification
    const incomingToken = request.headers.get("x-shiprocket-webhook-token") || request.headers.get("token");
    if (expectedToken && incomingToken !== expectedToken) {
      console.warn(`[Shiprocket Webhook] Unauthorized attempt with invalid token from IP: ${clientIp}`);
      return NextResponse.json({ message: "Invalid webhook token" }, { status: 401 });
    }

    const payload = await request.json();

    // 3. Replay Attack Protection (5-minute timestamp window check)
    const eventTimeStr = payload.current_timestamp || payload.timestamp || payload.etd;
    if (eventTimeStr) {
      const eventTime = new Date(eventTimeStr).getTime();
      const now = Date.now();
      if (!isNaN(eventTime) && Math.abs(now - eventTime) > 5 * 60 * 1000) {
        console.warn(`[Shiprocket Webhook] Stale webhook event rejected. Age: ${Math.round(Math.abs(now - eventTime) / 1000)}s`);
        return NextResponse.json({ message: "Stale webhook event" }, { status: 400 });
      }
    }

    const srOrderId = payload.order_id || payload.channel_order_id;
    const srShipmentId = payload.shipment_id;
    const statusCode = Number(payload.current_status_id || payload.status_id);
    const statusName = payload.current_status || payload.status || "";
    const awbCode = payload.awb || payload.awb_code || "";
    const currentLocation = payload.current_location || payload.location || "";
    const etd = payload.etd || "";

    if (!srOrderId && !srShipmentId) {
      return NextResponse.json({ message: "Missing order reference in payload" }, { status: 400 });
    }

    // Find local order
    const order: any = await Order.findOne({
      $or: [
        { _id: srOrderId },
        { "shipmentDetails.shiprocket.orderId": Number(srOrderId) },
        { "shipmentDetails.shiprocket.shipmentId": Number(srShipmentId) },
        { "shipmentDetails.shiprocket.awbCode": awbCode },
      ]
    });

    if (!order) {
      console.warn(`[Shiprocket Webhook] No local order found for SR Order ID ${srOrderId} / Shipment ID ${srShipmentId}`);
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    order.shipmentDetails = order.shipmentDetails || { type: "shiprocket", trackingId: awbCode || "SR-TRACK" };
    order.shipmentDetails.shiprocket = order.shipmentDetails.shiprocket || {};

    // 4. Idempotency Check
    if (order.shipmentDetails.shiprocket.currentStatusCode === statusCode) {
      return NextResponse.json({ message: "Event already processed", orderId: order._id });
    }

    // 5. Map Shiprocket Status Code to FlexSell Status [UPDATED-4]
    let newFlexStatus = order.status;
    let description = `Shiprocket status updated to: ${statusName}`;

    switch (statusCode) {
      case 1: // AWB Assigned
      case 2: // Pickup Scheduled
        newFlexStatus = "Awaiting Shipment";
        description = `Cargo package ready at warehouse. AWB: ${awbCode || order.shipmentDetails.shiprocket.awbCode}. Status: ${statusName}`;
        break;

      case 6: // Shipped / Picked up
        newFlexStatus = "Shipped";
        description = `Cargo picked up by courier (${order.shipmentDetails.shiprocket.courierName || 'Carrier'}). Waybill: ${awbCode}`;
        break;

      case 17: // In Transit
      case 38: // Out for Delivery
        newFlexStatus = "In Transit";
        description = statusCode === 38 
          ? `Package out for delivery to destination dock.${currentLocation ? ` Location: ${currentLocation}` : ''}`
          : `Package in transit.${currentLocation ? ` Location: ${currentLocation}` : ''}`;
        break;

      case 7: // Delivered
        newFlexStatus = "Delivered";
        description = `Order cargo successfully delivered to customer dock. Verified by Shiprocket.`;
        order.shipmentDetails.deliveredAt = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        break;

      case 8: // RTO Initiated
        description = `Return to Origin (RTO) initiated by courier. Reason: ${payload.reason || statusName}`;
        break;

      case 9: // Cancelled
      case 10: // RTO Delivered
        newFlexStatus = "Cancelled";
        description = `Shiprocket shipment cancelled. Reason: ${payload.reason || statusName}`;
        break;

      default:
        description = `Shiprocket update: ${statusName} ${currentLocation ? `at ${currentLocation}` : ''}`;
        break;
    }

    // Update order subfields
    order.status = newFlexStatus;
    if (ORDER_STATUS_CLASSES[newFlexStatus]) {
      order.statusClass = ORDER_STATUS_CLASSES[newFlexStatus];
    }

    order.shipmentDetails.shiprocket.currentStatus = statusName;
    order.shipmentDetails.shiprocket.currentStatusCode = statusCode;
    if (awbCode) {
      order.shipmentDetails.trackingId = awbCode;
      order.shipmentDetails.shiprocket.awbCode = awbCode;
      order.shipmentDetails.trackingUrl = `https://shiprocket.co/tracking/${awbCode}`;
    }
    if (etd) {
      order.shipmentDetails.estimatedDelivery = etd;
      order.shipmentDetails.shiprocket.etd = etd;
    }

    const timestamp = new Date().toLocaleString("en-US", {
      month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    order.history.unshift({
      status: newFlexStatus,
      timestamp,
      description
    });

    await order.save();

    // 6. Notify Customer
    const targetCustomerId = (await Customer.findOne({ email: order.shippingAddress.email.toLowerCase() }).select("_id"))?._id || "";
    dispatchWebhook("order.status_updated", order, targetCustomerId, {
      title: `Shipment Update: ${newFlexStatus}`,
      message: `Your order ${order._id} tracking status has been updated to "${statusName}". ${description}`,
      type: newFlexStatus === "Cancelled" ? "warning" : newFlexStatus === "Delivered" ? "success" : "info"
    }).catch(console.error);

    return NextResponse.json({ message: "Webhook processed successfully", orderId: order._id, status: newFlexStatus });
  } catch (error: any) {
    console.error("[Shiprocket Webhook Exception]:", error);
    return NextResponse.json({ message: error.message || "Internal webhook error" }, { status: 500 });
  }
}
