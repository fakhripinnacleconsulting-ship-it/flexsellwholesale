import { NextResponse } from "next/server";
import { handleSystemEvent } from "@/lib/events/eventHandlers";
import { SystemEventPayload } from "@/lib/events/eventDispatcher";
import { rateLimit } from "@/lib/rateLimit";
import { requireAuth } from "@/lib/authGuard";

/**
 * Event types a browser is allowed to raise.
 *
 * Everything else is dispatched server-side, where `await dispatchEvent()` calls
 * `handleSystemEvent()` through a direct import and never touches this route. Keeping
 * this list to no-email, self-addressed events means a caller cannot use the endpoint
 * to send mail from our domain to an arbitrary address.
 */
export const CLIENT_ALLOWED_EVENTS = ["CART_ITEM_ADDED", "CART_ITEM_REMOVED"] as const;

export async function POST(req: Request) {
  try {
    // Authenticated callers only. This endpoint reaches the mail and web-push
    // transports, so an anonymous caller could otherwise use it as a spam relay.
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const user = auth.payload!;

    try {
      await rateLimit(user.userId, "general");
    } catch {
      return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const payload: SystemEventPayload = await req.json();
    if (!payload || !payload.eventType) {
      return NextResponse.json({ message: "Invalid event payload" }, { status: 400 });
    }

    if (!(CLIENT_ALLOWED_EVENTS as readonly string[]).includes(payload.eventType)) {
      return NextResponse.json(
        { message: "Event type not permitted from client" },
        { status: 403 }
      );
    }

    // Identity always comes from the session, never from the request body — otherwise a
    // caller could address a notification (or an email) to any other customer.
    const safePayload: SystemEventPayload = {
      ...payload,
      actor: {
        id: user.userId,
        name: user.email,
        role: user.role === "admin" ? "admin" : "customer",
      },
      recipient: {
        customerId: user.userId,
        email: user.email,
        role: "customer",
      },
    };

    await handleSystemEvent(safePayload);

    return NextResponse.json({ success: true, eventId: safePayload.eventId });
  } catch (error: unknown) {
    console.error("[EVENT API ERROR] Failed to dispatch server event:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to dispatch event" },
      { status: 500 }
    );
  }
}

