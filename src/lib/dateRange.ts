import { toISTDateKey } from "./datetime";

/**
 * Date ranges for wallet statements and breakdowns.
 *
 * Built around the **Indian financial year** (1 April – 31 March) rather than the calendar
 * year, because that is the window a business owner and their accountant actually work in —
 * a wallet statement is filed against an FY, not against January to December.
 *
 * All boundaries are computed in local time and sent as ISO strings; the server widens the
 * closing day to 23:59:59 so a range ending "31 March" includes that day's transactions
 * instead of silently stopping at midnight.
 */

export type RangeKey =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_fy"
  | "last_fy"
  | "all"
  | "custom";

export interface DateRange {
  key: RangeKey;
  from?: string;
  to?: string;
}

export const RANGE_PRESETS: Array<{ key: RangeKey; label: string }> = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_3_months", label: "Last 3 months" },
  { key: "this_fy", label: "This financial year" },
  { key: "last_fy", label: "Last financial year" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range…" },
];

/** The April in which the financial year containing `date` began. */
function fyStartYear(date: Date): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
}

/**
 * Turns a preset into concrete boundaries.
 *
 * `all` returns no boundaries at all rather than a very old start date — the server treats
 * a missing range as unbounded, and an arbitrary epoch would quietly exclude anything
 * older, which for an "all time" statement is exactly the wrong failure.
 */
export function resolveRange(key: RangeKey, custom?: { from?: string; to?: string }): DateRange {
  const now = new Date();

  switch (key) {
    case "this_month":
      return {
        key,
        from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
        to: now.toISOString(),
      };

    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      // Day 0 of the current month is the last day of the previous one.
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { key, from: start.toISOString(), to: end.toISOString() };
    }

    case "last_3_months":
      return {
        key,
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(),
        to: now.toISOString(),
      };

    case "this_fy": {
      const start = fyStartYear(now);
      return { key, from: new Date(start, 3, 1).toISOString(), to: now.toISOString() };
    }

    case "last_fy": {
      const start = fyStartYear(now) - 1;
      // 31 March of the following year — month index 2 is March.
      return {
        key,
        from: new Date(start, 3, 1).toISOString(),
        to: new Date(start + 1, 2, 31).toISOString(),
      };
    }

    case "custom":
      // An incomplete custom range is treated as no range, so a half-filled picker shows
      // everything rather than an empty statement the customer cannot explain.
      if (custom?.from && custom?.to) {
        return { key, from: new Date(custom.from).toISOString(), to: new Date(custom.to).toISOString() };
      }
      return { key };

    case "all":
    default:
      return { key };
  }
}

/** Human label for the active range, for statement headers and empty states. */
export function describeRange(range: DateRange): string {
  if (range.key === "all" || !range.from || !range.to) return "All time";

  const preset = RANGE_PRESETS.find((p) => p.key === range.key);
  if (preset && range.key !== "custom") return preset.label;

  return `${toISTDateKey(range.from)} to ${toISTDateKey(range.to)}`;
}

/** The FY label a range falls in, e.g. "FY 2026-27". Used in export filenames. */
export function financialYearLabel(date: Date = new Date()): string {
  const start = fyStartYear(date);
  return `FY ${start}-${String(start + 1).slice(2)}`;
}
