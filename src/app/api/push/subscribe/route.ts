import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import PushSubscription from "@/models/PushSubscription";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { userId, role, endpoint, keys, userAgent } = body;

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return NextResponse.json({ message: "Invalid push subscription payload." }, { status: 400 });
    }

    const sub = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId: userId || "anonymous",
        role: role || "customer",
        endpoint,
        keys,
        userAgent,
        isActive: true,
        lastUsedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, subscription: sub });
  } catch (err: any) {
    console.error("Push subscribe error:", err);
    return NextResponse.json({ message: err.message || "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { endpoint } = body;

    if (endpoint) {
      await PushSubscription.findOneAndUpdate({ endpoint }, { isActive: false });
    }

    return NextResponse.json({ success: true, message: "Push subscription deactivated." });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Deactivation failed" }, { status: 500 });
  }
}
