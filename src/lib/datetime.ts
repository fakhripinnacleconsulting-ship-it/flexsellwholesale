/**
 * Indian Standard Time formatting — the single place dates become display text.
 *
 * Why this exists: order history timestamps used to be *stored* as pre-formatted strings
 * produced by `new Date().toLocaleString("en-US", { ... })` with no `timeZone` option.
 * Vercel's Node runtime is UTC, so an order placed at 9:00 PM IST was written as
 * "Aug 14, 2026, 03:30 PM" — the wrong clock time, in a US format, and unfixable later
 * because the original instant had already been thrown away.
 *
 * The rule this module enforces:
 *
 *   store instants (Date / ISO)  →  format at the edge, always in Asia/Kolkata
 *
 * Never call `toLocaleString` / `toLocaleDateString` directly in an API route or a
 * component. Use these helpers, so the timezone and locale can never drift apart again.
 */

export const IST_TIME_ZONE = "Asia/Kolkata";

/**
 * `en-IN`, not `en-US`. Locale matters as much as the timezone here: `en-US` renders
 * 14 August as "8/14/2026", which an Indian reader parses as 8 August.
 */
const IST_LOCALE = "en-IN";

export type DateInput = Date | string | number | null | undefined;

/** Matches an explicit timezone designator: trailing `Z`, or `+05:30` / `-0800`. */
const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Coerces the three shapes that exist in this database into a Date:
 *
 *  - a real `Date` (what everything new writes)
 *  - an ISO string with a timezone (`/api/orders/public` used to write these)
 *  - a legacy `en-US` display string, e.g. "Aug 14, 2026, 03:30 PM"
 *
 * The legacy strings are the subtle case. They carry **no timezone**, and `new Date()`
 * resolves a naive string using the *reader's* local timezone — so the same stored value
 * would decode differently on a Vercel box (UTC) and on a developer's machine (IST),
 * silently shifting every historical timestamp by 5h30m.
 *
 * They were rendered on the server, which runs in UTC, so UTC is the only correct reading.
 * We force it explicitly rather than inheriting whatever the runtime happens to be.
 *
 * Anything genuinely unparseable returns null, so the caller can show the raw text
 * instead of a confidently wrong date.
 */
export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }

  const raw = value.trim();
  if (!raw) return null;

  // Already carries a timezone (ISO with Z or an offset) — parse as-is.
  if (HAS_TIMEZONE.test(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // Naive string: pin it to UTC, which is what the server wrote it in.
  //
  // The two shapes need different suffixes. An ISO-like string ("2026-08-14T15:30:00")
  // is spec'd to be read as *local* time and will not accept a " UTC" suffix, so it needs
  // a trailing "Z". A display string ("Aug 14, 2026, 03:30 PM") is the reverse.
  const isoLike = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw);
  const pinned = isoLike ? `${raw.replace(" ", "T")}Z` : `${raw} UTC`;

  const asUtc = new Date(pinned);
  if (!Number.isNaN(asUtc.getTime())) return asUtc;

  // Last resort for shapes V8 will not accept with a suffix. Bare "YYYY-MM-DD" is already
  // spec'd to parse as UTC, so it lands here correctly.
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function format(value: DateInput, options: Intl.DateTimeFormatOptions, fallback: string): string {
  const date = toDate(value);
  if (!date) {
    // Preserve an unparseable legacy string as-is. Showing the original text is honest;
    // showing "Invalid Date" or silently substituting today's date is not.
    return typeof value === "string" && value.trim() ? value : fallback;
  }
  return new Intl.DateTimeFormat(IST_LOCALE, { timeZone: IST_TIME_ZONE, ...options }).format(date);
}

/** `14 Aug 2026` */
export function formatDateIST(value: DateInput, fallback = "—"): string {
  return format(value, { day: "2-digit", month: "short", year: "numeric" }, fallback);
}

/** `14 Aug 2026, 9:00 pm` — the default for anything a customer or auditor reads. */
export function formatDateTimeIST(value: DateInput, fallback = "—"): string {
  return format(
    value,
    { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true },
    fallback
  );
}

/** `9:00 pm` */
export function formatTimeIST(value: DateInput, fallback = "—"): string {
  return format(value, { hour: "numeric", minute: "2-digit", hour12: true }, fallback);
}

/** `Thu, 14 Aug 2026, 9:00:15 pm` — receipts and audit trails, where seconds matter. */
export function formatFullIST(value: DateInput, fallback = "—"): string {
  return format(
    value,
    {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    },
    fallback
  );
}

/** `14/08/2026` — compact numeric, for dense tables and exports. */
export function formatNumericDateIST(value: DateInput, fallback = "—"): string {
  return format(value, { day: "2-digit", month: "2-digit", year: "numeric" }, fallback);
}

/**
 * `2026-08-14` in IST — for `<input type="date">` values and date grouping.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that yields the **UTC** day, so any
 * instant between 00:00 and 05:30 IST would be filed under the previous date.
 */
export function toISTDateKey(value: DateInput): string {
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts;
}

/** Relative age for activity feeds; falls back to an absolute IST date past a week. */
export function formatRelativeIST(value: DateInput, fallback = "—"): string {
  const date = toDate(value);
  if (!date) return typeof value === "string" && value.trim() ? value : fallback;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} d ago`;
  return formatDateIST(date, fallback);
}
