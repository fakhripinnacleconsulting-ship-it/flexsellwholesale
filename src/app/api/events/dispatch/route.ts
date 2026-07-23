import { NextResponse } from "next/server";
import { handleSystemEvent } from "@/lib/events/eventHandlers";
import { SystemEventPayload } from "@/lib/events/eventDispatcher";

export async function POST(req: Request) {
  try {
    const payload: SystemEventPayload = await req.json();
    if (!payload || !payload.eventType) {
      return NextResponse.json({ message: "Invalid event payload" }, { status: 400 });
    }

    console.log(`[API EVENT DISPATCH] Received ${payload.eventType} for entity ${payload.entity?.type}:${payload.entity?.id}`);

    // Process server-side email dispatch and web push dispatch asynchronously
    await handleSystemEvent(payload);

    return NextResponse.json({ success: true, eventId: payload.eventId });
  } catch (error: any) {
    console.error("[EVENT API ERROR] Failed to dispatch server event:", error);
    return NextResponse.json({ message: error.message || "Failed to dispatch event" }, { status: 500 });
  }
}
