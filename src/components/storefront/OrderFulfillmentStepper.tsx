"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { formatDateTimeIST } from "@/lib/datetime";
import type { HistoryEvent } from "@/types";

interface OrderFulfillmentStepperProps {
  history?: HistoryEvent[];
  /**
   * `customer` shows only the customer-safe note — fulfilment is attributed to FlexSell
   * Wholesale, never to an individual staff member.
   *
   * `internal` shows the staff note plus who acted. Note that the customer API projects
   * `internalNote` and `actor` away at query level, so this variant simply has nothing to
   * render if it is ever mounted on a customer response — it cannot leak.
   */
  variant?: "customer" | "internal";
  title?: string;
}

function dotClass(status: string): string {
  if (status === "Delivered") return "border-green-600 bg-green-600";
  if (status === "Shipped" || status === "In Transit") return "border-primary bg-primary";
  if (status === "Cancelled") return "border-destructive bg-destructive";
  return "border-yellow-500 bg-yellow-500";
}

export function OrderFulfillmentStepper({
  history,
  variant = "customer",
  title = "Fulfillment Status",
}: OrderFulfillmentStepperProps) {
  if (!Array.isArray(history) || history.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h4>

      <ol className="relative pl-4 border-l border-border space-y-6 ml-1 text-xs">
        {history.map((event, i) => {
          const note =
            variant === "internal"
              ? event.internalNote || event.description || event.customerNote
              : event.customerNote || event.description;

          return (
            <li key={i} className="relative space-y-1">
              <span
                className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 ${dotClass(event.status)}`}
                aria-hidden="true"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-foreground">{event.status}</span>
                {/* One formatter for every step, so a single order can no longer display
                    three different date shapes. Legacy string is the fallback. */}
                <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {formatDateTimeIST(event.at ?? event.timestamp)}
                </time>
              </div>
              {note && <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>}
              {variant === "internal" && event.actor?.role && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  {event.actor.role === "Manager" && event.actor.name ? event.actor.name : event.actor.role}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
