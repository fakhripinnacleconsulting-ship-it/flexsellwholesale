"use client";

import * as React from "react";
import { Input } from "@/components/ui/Input";
import { toISTDateKey } from "@/lib/datetime";
import { RANGE_PRESETS, resolveRange, type DateRange, type RangeKey } from "@/lib/dateRange";
import { CalendarRange } from "lucide-react";

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Rendered inline in a card header, so it stays compact by default. */
  className?: string;
}

/**
 * Preset ranges plus a custom from/to.
 *
 * The custom inputs only appear once "Custom range…" is chosen, rather than sitting there
 * permanently: two date fields beside a dropdown invite the reader to fill them in when the
 * preset already answered the question.
 *
 * Nothing is emitted until **both** custom dates are set. A half-filled range would produce
 * an empty statement, and an empty statement with no explanation reads as lost money.
 */
export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [customFrom, setCustomFrom] = React.useState(() =>
    value.from ? toIsoDate(value.from) : ""
  );
  const [customTo, setCustomTo] = React.useState(() => (value.to ? toIsoDate(value.to) : ""));

  const today = toISTDateKey(new Date());
  const isCustom = value.key === "custom";

  const handlePreset = (key: RangeKey) => {
    if (key === "custom") {
      onChange(resolveRange("custom", { from: customFrom, to: customTo }));
      return;
    }
    onChange(resolveRange(key));
  };

  const handleCustom = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (from && to) onChange(resolveRange("custom", { from, to }));
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
      <label className="sr-only" htmlFor="wallet-range">
        Date range
      </label>
      <div className="relative">
        <CalendarRange
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <select
          id="wallet-range"
          value={value.key}
          onChange={(e) => handlePreset(e.target.value as RangeKey)}
          className="h-8 cursor-pointer rounded-md border bg-background pl-7 pr-2 text-[11px] font-semibold text-foreground"
        >
          {RANGE_PRESETS.map((preset) => (
            <option key={preset.key} value={preset.key}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {isCustom && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="From date"
            value={customFrom}
            // Never let the start pass the end; the picker enforces what the query assumes.
            max={customTo || today}
            onChange={(e) => handleCustom(e.target.value, customTo)}
            className="h-8 w-[8.5rem] cursor-pointer text-[11px]"
          />
          <span className="text-[11px] text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={customTo}
            min={customFrom || undefined}
            max={today}
            onChange={(e) => handleCustom(customFrom, e.target.value)}
            className="h-8 w-[8.5rem] cursor-pointer text-[11px]"
          />
        </div>
      )}
    </div>
  );
}

/** ISO timestamp to the `yyyy-mm-dd` a date input expects. */
function toIsoDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toISTDateKey(date);
}
