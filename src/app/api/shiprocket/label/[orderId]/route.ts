import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { requireAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
import { shiprocketClient } from "@/lib/shiprocketClient";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const { orderId } = await params;
    const order: any = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const access = await verifyManagerOrderAccess(payload, order);
    if (access.error) return access.error;

    const sr = order.shipmentDetails?.shiprocket;
    if (!sr || !sr.shipmentId) {
      return NextResponse.json({ message: "Order is not fulfilled via Shiprocket" }, { status: 400 });
    }

    if (sr.labelUrl) {
      return NextResponse.json({ labelUrl: sr.labelUrl });
    }

    // Generate label dynamically
    const res = await shiprocketClient.generateLabel([sr.shipmentId]);
    const labelUrl = res?.label_url || res?.response?.label_url || "";

    if (!labelUrl) {
      return NextResponse.json({ message: res.message || "Failed to generate label from Shiprocket" }, { status: 400 });
    }

    // Save label URL to DB asynchronously
    Order.findByIdAndUpdate(orderId, {
      $set: { "shipmentDetails.shiprocket.labelUrl": labelUrl }
    }).catch(console.error);

    return NextResponse.json({ labelUrl });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch shipping label" }, { status: 500 });
  }
}
