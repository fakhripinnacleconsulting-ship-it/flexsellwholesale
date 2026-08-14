import type { HistoryActor, HistoryEvent } from "@/types";

/**
 * Builds fulfilment-stepper events.
 *
 * Every history entry in the application must come from here. Before this existed, seven
 * routes each hand-rolled their own event and drifted apart in two ways that reached
 * customers:
 *
 *  1. Timestamps were pre-formatted strings — five routes used
 *     `toLocaleString("en-US", …)` with no timeZone (so UTC, in a US format, on Vercel),
 *     one used `toISOString()`. One order could show three different date formats.
 *  2. The actor was hard-coded into the description, so a manager's action was labelled
 *     "by administrator", and there was no machine-readable record of who acted.
 */

export type ActorRole = "Admin" | "Manager" | "Customer" | "System";

/** The session shape the auth guards return. */
interface SessionLike {
  role?: string;
  userId?: string;
  email?: string;
}

/**
 * Derives the actor from the **session**, never from request input.
 *
 * `displayName` should be the manager's or customer's real name where available — it is
 * what staff see in the internal note. Admins are deliberately recorded as plain "Admin"
 * rather than a personal name, matching how the business refers to them.
 */
export function resolveActor(payload: SessionLike | null | undefined, displayName?: string): HistoryActor {
  if (!payload) return { role: "System", name: "System" };

  switch (payload.role) {
    case "admin":
      return { role: "Admin", name: "Admin", userId: payload.userId };
    case "manager":
      return { role: "Manager", name: displayName || "Manager", userId: payload.userId };
    case "customer":
      return { role: "Customer", name: displayName || "Customer", userId: payload.userId };
    default:
      return { role: "System", name: "System", userId: payload.userId };
  }
}

export const SYSTEM_ACTOR: HistoryActor = { role: "System", name: "System" };

/** How staff are described to a customer. Never a personal name. */
const BRAND = "FlexSell Wholesale";

/**
 * The label used inside internal notes: "Admin", or the manager's actual name.
 */
export function actorLabel(actor: HistoryActor): string {
  if (actor.role === "Manager") return actor.name ? `Manager ${actor.name}` : "Manager";
  if (actor.role === "Customer") return actor.name ? `Customer ${actor.name}` : "Customer";
  if (actor.role === "Admin") return "Admin";
  return "System";
}

/**
 * Creates a history event with a real instant and both note variants.
 *
 * Legacy `timestamp` / `description` are still populated so any screen not yet migrated
 * keeps working during rollout. `timestamp` is written as an ISO string — unlike the old
 * locale strings it is unambiguous, so even the legacy path can be reformatted correctly.
 */
export function buildHistoryEvent(params: {
  status: string;
  customerNote: string;
  internalNote: string;
  actor: HistoryActor;
  at?: Date;
}): HistoryEvent {
  const at = params.at ?? new Date();
  return {
    status: params.status,
    at,
    customerNote: params.customerNote,
    internalNote: params.internalNote,
    actor: params.actor,
    // Legacy mirrors — kept readable for un-migrated screens, but unambiguous now.
    timestamp: at.toISOString(),
    description: params.customerNote,
  };
}

/**
 * Standard wording for each step.
 *
 * The customer column never names a staff member: as far as a buyer is concerned the
 * actor is always FlexSell Wholesale. The internal column names Admin or the manager.
 */
export function orderStatusNotes(
  status: string,
  actor: HistoryActor,
  extra?: { carrier?: string; trackingId?: string; reason?: string; origin?: string }
): { customerNote: string; internalNote: string } {
  const who = actorLabel(actor);
  const byCustomer = actor.role === "Customer";

  switch (status) {
    case "Placed":
    case "Pending":
      return {
        customerNote: "Order placed successfully.",
        internalNote: `Order created${extra?.origin ? ` via ${extra.origin}` : ""} by ${who}.`,
      };

    case "Confirmed":
      return {
        customerNote: `Order confirmed by ${BRAND}.`,
        internalNote: `Order confirmed by ${who}.`,
      };

    case "Processing":
      return {
        customerNote: "Your order is being prepared for dispatch.",
        internalNote: `Packaging and B2B validation completed by ${who}.`,
      };

    case "Awaiting Shipment":
      return {
        customerNote: `Your order is packed and awaiting pickup by ${BRAND}.`,
        internalNote: `Marked awaiting shipment by ${who}.`,
      };

    case "Shipped":
    case "In Transit": {
      const tracking = extra?.trackingId ? ` Tracking ID: ${extra.trackingId}` : "";
      return {
        customerNote: `Shipped by ${BRAND}.${tracking}`,
        internalNote: `Dispatched${extra?.carrier ? ` via ${extra.carrier}` : ""} by ${who}.${tracking}`,
      };
    }

    case "Delivered":
      return {
        customerNote: "Your order has been delivered.",
        internalNote: `Marked delivered by ${who}.`,
      };

    case "Cancelled":
      return {
        customerNote: byCustomer ? "You cancelled this order." : `Order cancelled by ${BRAND}.`,
        internalNote: `Order cancelled by ${who}.${extra?.reason ? ` Reason: ${extra.reason}` : ""}`,
      };

    default:
      return {
        customerNote: `Order status updated to ${status}.`,
        internalNote: `Status changed to ${status} by ${who}.`,
      };
  }
}

/**
 * Strips staff-only fields from an order's history.
 *
 * Preferred usage is a query-level projection (`-history.internalNote -history.actor`);
 * this is the belt-and-braces version for paths that already hold a hydrated document.
 */
export function toCustomerHistory(history: HistoryEvent[] | undefined): HistoryEvent[] {
  if (!Array.isArray(history)) return [];
  return history.map((event) => ({
    status: event.status,
    at: event.at,
    timestamp: event.timestamp,
    customerNote: event.customerNote ?? event.description,
    description: event.customerNote ?? event.description,
  }));
}
