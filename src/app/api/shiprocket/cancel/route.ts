import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { shiprocketClient } from "@/lib/shiprocketClient";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";

export async function POST(request: NextRequest) {
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

    const { orderId } = await request.json();
    const order: any = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const sr = order.shipmentDetails?.shiprocket;
    if (!sr || !sr.orderId) {
      return NextResponse.json({ message: "This order does not have an active Shiprocket booking." }, { status: 400 });
    }

    try {
      await shiprocketClient.cancelOrder([sr.orderId]);
    } catch (err: any) {
      console.warn(`[Shiprocket Cancel] API call warning for order ${sr.orderId}:`, err.message);
    }

    order.status = "Cancelled";
    order.statusClass = ORDER_STATUS_CLASSES["Cancelled"];
    sr.currentStatus = "CANCELED";

    const timestamp = new Date().toLocaleString("en-US", {
      month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    });

    order.history.unshift({
      status: "Cancelled",
      timestamp,
      description: "Shiprocket shipment cancelled by administrator."
    });

    await order.save();

    return NextResponse.json({ message: "Shiprocket order cancelled successfully", order });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to cancel Shiprocket order" }, { status: 500 });
  }
}
