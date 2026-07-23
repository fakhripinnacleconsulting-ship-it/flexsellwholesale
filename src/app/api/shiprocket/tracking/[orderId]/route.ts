import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { shiprocketClient } from "@/lib/shiprocketClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    await dbConnect();
    const { orderId } = await params;

    const order: any = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const sr = order.shipmentDetails?.shiprocket;
    if (!sr || (!sr.shipmentId && !sr.awbCode)) {
      return NextResponse.json({
        hasShiprocket: false,
        tracking: null,
        history: order.history || []
      });
    }

    let liveTracking: any = null;
    try {
      if (sr.shipmentId) {
        liveTracking = await shiprocketClient.getTracking(sr.shipmentId);
      }
    } catch (err: any) {
      console.warn(`[Shiprocket Tracking API] Failed to fetch live tracking for shipment ${sr.shipmentId}:`, err.message);
    }

    return NextResponse.json({
      hasShiprocket: true,
      shiprocketDetails: sr,
      liveTracking: liveTracking?.tracking_data || liveTracking || null,
      history: order.history || []
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch tracking details" }, { status: 500 });
  }
}
