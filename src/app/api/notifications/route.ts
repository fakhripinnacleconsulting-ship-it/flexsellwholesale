import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Notification from "@/models/Notification";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

interface Session {
  userId: string;
  role: string;
}

/**
 * Resolves the caller from the session cookie.
 *
 * Every handler below scopes its query off this and never off a client-supplied
 * `role`/`customerId` parameter — trusting those let any customer read another
 * customer's feed and wipe the admin feed.
 */
async function getSession(): Promise<{ session?: Session; error?: NextResponse }> {
  const token = await getTokenFromCookie();
  if (!token) {
    return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
  }
  const payload = verifyToken(token);
  if (!payload) {
    return { error: NextResponse.json({ message: "Invalid session" }, { status: 401 }) };
  }
  return { session: { userId: payload.userId, role: payload.role } };
}

/** The set of notifications a given caller is allowed to see or act on. */
function scopeFor(session: Session) {
  if (session.role === "admin") {
    return { $or: [{ recipientRole: "admin" }, { customerId: "admin" }] };
  }
  return {
    customerId: { $in: [session.userId, "all"] },
    recipientRole: { $ne: "admin" },
  };
}

// GET: Retrieve notifications for the authenticated caller
export async function GET() {
  try {
    const { session, error } = await getSession();
    if (error) return error;

    await dbConnect();

    const notifications = await Notification.find(scopeFor(session!))
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json(notifications);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fetch notifications" },
      { status: 500 }
    );
  }
}

// PUT: Mark a notification as read, or mark all as read
export async function PUT(request: Request) {
  try {
    const { session, error } = await getSession();
    if (error) return error;

    await dbConnect();
    const body = await request.json();
    const { _id, markAll } = body;

    if (markAll) {
      await Notification.updateMany(scopeFor(session!), { $set: { isRead: true } });
      return NextResponse.json({ message: "All notifications marked as read." });
    }

    if (!_id) {
      return NextResponse.json({ message: "Notification ID is required" }, { status: 400 });
    }

    // Scoping the update itself means an id outside the caller's scope simply matches
    // nothing — no separate ownership branch that could be forgotten.
    const result = await Notification.updateOne(
      { $and: [{ _id }, scopeFor(session!)] },
      { $set: { isRead: true } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Notification not found" }, { status: 404 });
    }

    const updated = await Notification.findById(_id).lean();
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update notification" },
      { status: 500 }
    );
  }
}

// DELETE: Remove one notification, or clear all of the caller's own
export async function DELETE(request: Request) {
  try {
    const { session, error } = await getSession();
    if (error) return error;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll");

    if (clearAll === "true") {
      await Notification.deleteMany(scopeFor(session!));
      return NextResponse.json({ message: "All notifications cleared successfully" });
    }

    if (!id) {
      return NextResponse.json({ message: "Notification ID is required" }, { status: 400 });
    }

    const result = await Notification.deleteOne({ $and: [{ _id: id }, scopeFor(session!)] });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Notification not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Notification deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete notification" },
      { status: 500 }
    );
  }
}
