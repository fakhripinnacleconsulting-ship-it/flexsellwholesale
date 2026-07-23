import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Notification from "@/models/Notification";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

// GET: Retrieve notifications (role or customer specific)
export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get("role");
    const customerIdParam = searchParams.get("customerId");

    let query: any = {};
    if (roleParam === "admin" || payload.role === "admin") {
      query = { $or: [{ recipientRole: "admin" }, { customerId: "admin" }] };
    } else {
      const targetId = customerIdParam || payload.userId;
      query = { customerId: { $in: [targetId, "all"] }, recipientRole: { $ne: "admin" } };
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json(notifications);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch notifications" }, { status: 500 });
  }
}

// PUT: Mark notification as read or mark all as read
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { _id, markAll, role } = body;

    if (markAll) {
      const query = role === "admin" || payload.role === "admin"
        ? { $or: [{ recipientRole: "admin" }, { customerId: "admin" }] }
        : { customerId: payload.userId };

      await Notification.updateMany(query, { $set: { isRead: true } });
      return NextResponse.json({ message: "All notifications marked as read." });
    }

    if (!_id) {
      return NextResponse.json({ message: "Notification ID is required" }, { status: 400 });
    }

    const notif = await Notification.findById(_id);
    if (!notif) {
      return NextResponse.json({ message: "Notification not found" }, { status: 404 });
    }

    notif.isRead = true;
    await notif.save();

    return NextResponse.json(notif);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update notification" }, { status: 500 });
  }
}

// DELETE: Remove notification
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ message: "Notification ID is required" }, { status: 400 });
    }

    await Notification.findByIdAndDelete(id);
    return NextResponse.json({ message: "Notification deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete notification" }, { status: 500 });
  }
}
