import { after } from "next/server";
import { handleSystemEvent } from "./eventHandlers";
import { SystemEventPayload } from "./eventDispatcher";

/**
 * Server-only dispatcher that uses Next.js `after()` to process
 * events (like emails and notifications) in the background.
 * This ensures the API responds instantly to the user while Vercel 
 * safely executes the background work.
 */
export function dispatchEventServer(payload: SystemEventPayload): void {
  const fullPayload: SystemEventPayload = {
    ...payload,
    eventId: payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  console.log(`[EVENT DISPATCHED (Background)] Type: ${fullPayload.eventType}`);

  // Schedule background execution
  after(async () => {
    try {
      await handleSystemEvent(fullPayload);
    } catch (err) {
      console.error(`[Event Dispatch Error] Failed to process ${fullPayload.eventType}:`, err);
    }
  });
}
