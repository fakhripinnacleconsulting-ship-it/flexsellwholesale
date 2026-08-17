import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import NotificationPreference from "@/models/NotificationPreference";
import { requireAuth, requireAdminOrManagerAuth } from "@/lib/authGuard";

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { payload, error } = await requireAuth();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");
    
    let targetUserId = payload!.userId;

    if (requestedUserId && requestedUserId !== "current" && requestedUserId !== payload!.userId) {
      if (payload!.role === "customer") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      const adminRes = await requireAdminOrManagerAuth();
      if (adminRes.error) return adminRes.error;
      targetUserId = requestedUserId;
    }

    const pref = await NotificationPreference.findOne({ userId: targetUserId });
    return NextResponse.json({
      success: true,
      preferences: pref || {
        userId: targetUserId,
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
    const { payload, error } = await requireAuth();
    if (error) return error;

    const body = await req.json();
    const { userId: requestedUserId, emailNotifications, pushNotifications, categories } = body;

    let targetUserId = payload!.userId;

    if (requestedUserId && requestedUserId !== "current" && requestedUserId !== payload!.userId) {
      if (payload!.role === "customer") {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      const adminRes = await requireAdminOrManagerAuth();
      if (adminRes.error) return adminRes.error;
      targetUserId = requestedUserId;
    }

    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: targetUserId },
      {
        userId: targetUserId,
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
