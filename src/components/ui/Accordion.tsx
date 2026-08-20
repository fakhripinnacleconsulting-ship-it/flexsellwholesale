"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
  /** Stable id — used to wire aria-controls / aria-labelledby to the panel. */
  id: string;
  title: React.ReactNode;
  /** Rendered on the right of the header, e.g. a balance or a count. Not clickable. */
  summary?: React.ReactNode;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  /** If provided, the accordion operates in controlled mode. */
  isOpen?: boolean;
  /** Called when the accordion is toggled. */
  onToggle?: (isOpen: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * A disclosure section.
 *
 * Content stays mounted and is hidden with `hidden` rather than being unmounted, so
 * collapsing a section does not throw away its loaded data and re-fetch it on the next
 * open — which on a Advance Balance would mean re-running an aggregation every time someone glances
 * away.
 *
 * The header is a real `<button>` so it works with the keyboard and announces its state;
 * the summary sits outside it so a balance is readable without being part of the control's
 * accessible name.
 */
export function Accordion({
  id,
  title,
  summary,
  icon,
  defaultOpen = false,
  isOpen: controlledIsOpen,
  onToggle,
  children,
  className,
}: AccordionProps) {
  const [internalIsOpen, setInternalIsOpen] = React.useState(defaultOpen);

  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    const nextState = !isOpen;
    if (!isControlled) {
      setInternalIsOpen(nextState);
    }
    onToggle?.(nextState);
  };

  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-center gap-2 pr-4">
        <button
          id={headerId}
          type="button"
          onClick={handleToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex flex-1 cursor-pointer items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-secondary/30"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              isOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
          {icon}
          <span className="text-sm font-bold tracking-tight text-foreground">{title}</span>
        </button>

        {summary && <div className="shrink-0 text-right">{summary}</div>}
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
        )}
        aria-hidden={!isOpen}
      >
        <div className="overflow-hidden">
          <div className="border-t p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
