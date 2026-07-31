import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public, unauthenticated lookup for guest order tracking.
// Deliberately narrow: matches only on Order ID + billing email, and returns
// only the fields the tracking UI renders — never the full order/shipping/items.
export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId")?.trim();
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!orderId || !email) {
      return NextResponse.json({ message: "Order ID and email are required." }, { status: 400 });
    }

    await dbConnect();

    const order: any = await Order.findById(orderId.toUpperCase())
      .select("_id status amount itemsCount shipmentDetails history shippingAddress.email")
      .lean();

    if (!order || order.shippingAddress?.email?.toLowerCase() !== email) {
      return NextResponse.json({ message: "No matching order found." }, { status: 404 });
    }

    delete order.shippingAddress;
    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to track order" }, { status: 500 });
  }
}
