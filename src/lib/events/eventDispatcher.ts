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

export function dispatchEvent(payload: SystemEventPayload): void {
  const fullPayload: SystemEventPayload = {
    ...payload,
    eventId: payload.eventId || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  console.log(`[EVENT DISPATCHED] Type: ${fullPayload.eventType} | Entity: ${fullPayload.entity.type}:${fullPayload.entity.id}`);

  // Non-blocking asynchronous event handling execution
  setTimeout(() => {
    if (typeof window !== "undefined") {
      // Browser environment: handle client-side mock events
      try {
        handleClientMockEvent(fullPayload);
      } catch (err) {
        console.error(`[CLIENT EVENT HANDLER ERROR] Unhandled exception in mock event ${fullPayload.eventType}:`, err);
      }
    } else {
      // Server environment: dynamically import server handlers
      import("./eventHandlers")
        .then(({ handleSystemEvent }) => {
          handleSystemEvent(fullPayload).catch((err) => {
            console.error(`[EVENT HANDLER ERROR] Unhandled exception in event ${fullPayload.eventType}:`, err);
          });
        })
        .catch((err) => {
          console.error(`[EVENT DISPATCHER IMPORT ERROR] Failed to load server event handlers:`, err);
        });
    }
  }, 0);
}
