import { handleClientMockEvent } from "./eventHandlersClient";

export interface SystemEventPayload {
  eventId?: string;
  eventType: string;
  category: "orders" | "shipments" | "payments" | "quotes" | "invoices" | "security" | "system";
  actor: {
    id: string;
    name: string;
    role: "customer" | "admin" | "system";
  };
  recipient: {
    customerId?: string;
    email?: string;
    emailList?: string[];
    name?: string;
    role: "customer" | "admin" | "both";
  };
  entity: {
    type: string;
    id: string;
  };
  data?: Record<string, any>;
  timestamp?: string;
}

export async function dispatchEvent(payload: SystemEventPayload): Promise<void> {
  const fullPayload: SystemEventPayload = {
    ...payload,
    eventId: payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  console.log(`[EVENT DISPATCHED] Type: ${fullPayload.eventType} | Entity: ${fullPayload.entity.type}:${fullPayload.entity.id}`);

  if (typeof window !== "undefined") {
    // Browser environment: handle client-side mock events
    try {
      const { handleClientMockEvent } = await import("./eventHandlersClient");
      await handleClientMockEvent(fullPayload);
    } catch (err) {
      console.error(`[CLIENT EVENT HANDLER ERROR] Unhandled exception in mock event ${fullPayload.eventType}:`, err);
    }
  } else {
    // Server environment: dynamically import server handlers and await execution
    try {
      const { handleSystemEvent } = await import("./eventHandlers");
      await handleSystemEvent(fullPayload);
    } catch (err) {
      console.error(`[EVENT DISPATCHER ERROR] Failed to process server event ${fullPayload.eventType}:`, err);
    }
  }
}
