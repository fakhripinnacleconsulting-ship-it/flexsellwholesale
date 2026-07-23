import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import NotificationPreference from "@/models/NotificationPreference";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "current";

    const pref = await NotificationPreference.findOne({ userId });
    return NextResponse.json({
      success: true,
      preferences: pref || {
        userId,
        emailNotifications: true,
        pushNotifications: true,
        categories: {
          orders: true,
          shipments: true,
          payments: true,
          quotes: true,
          invoices: true,
          security: true,
          system: true,
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { userId, emailNotifications, pushNotifications, categories } = body;

    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: userId || "current" },
      {
        userId: userId || "current",
        emailNotifications: emailNotifications !== false,
        pushNotifications: pushNotifications !== false,
        categories: categories || {},
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, preferences: pref });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || "Failed to save preferences" }, { status: 500 });
  }
}
