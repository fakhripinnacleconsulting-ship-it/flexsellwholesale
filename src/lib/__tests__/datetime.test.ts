import { describe, it, expect } from "vitest";
import {
  formatDateIST,
  formatDateTimeIST,
  formatTimeIST,
  formatNumericDateIST,
  toISTDateKey,
  toDate,
} from "../datetime";

/**
 * These tests pin the exact defect that shipped: timestamps rendered in UTC (Vercel's
 * runtime timezone) while looking like local time, in a US format.
 *
 * 2026-08-14T15:30:00Z is 2026-08-14 21:00 IST — the classic case where the UTC date and
 * the IST date agree but the clock time is 5h30m out.
 */
const EVENING = "2026-08-14T15:30:00.000Z"; // 14 Aug 2026, 9:00 pm IST

/** 2026-08-14T20:00:00Z is 15 Aug 01:30 IST — UTC and IST fall on *different days*. */
const LATE_NIGHT = "2026-08-14T20:00:00.000Z";

/** 2026-08-14T02:00:00Z is 14 Aug 07:30 IST — safely the same day both ways. */
const MORNING = "2026-08-14T02:00:00.000Z";

describe("IST formatting", () => {
  it("renders the IST clock time, not UTC", () => {
    // The bug: this used to render 3:30 pm because no timeZone was passed.
    expect(formatTimeIST(EVENING)).toMatch(/9:00/);
    expect(formatTimeIST(EVENING)).not.toMatch(/3:30/);
  });

  it("rolls over to the next IST day for late-evening UTC instants", () => {
    // 20:00 UTC is already the 15th in India. A UTC-based formatter would say the 14th.
    expect(formatDateIST(LATE_NIGHT)).toContain("15");
    expect(formatDateIST(LATE_NIGHT)).toContain("Aug");
  });

  it("uses day-first order, never the US month-first order", () => {
    // en-US would produce 08/14/2026, which reads as 8 August to an Indian user.
    expect(formatNumericDateIST(MORNING)).toBe("14/08/2026");
  });

  it("includes both date and time in the default display format", () => {
    const out = formatDateTimeIST(EVENING);
    expect(out).toContain("14");
    expect(out).toContain("Aug");
    expect(out).toContain("2026");
    expect(out).toMatch(/9:00/);
  });
});

describe("legacy value handling", () => {
  it("parses the legacy en-US display strings back to the correct instant", () => {
    // These were produced server-side in UTC, so parsing them recovers the real instant.
    const legacy = "Aug 14, 2026, 03:30 PM";
    const parsed = toDate(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed!.toISOString()).toBe(EVENING);
    // ...and it must then render as 9:00 pm IST, which is what the user should have seen.
    expect(formatTimeIST(legacy)).toMatch(/9:00/);
  });

  it("parses ISO strings written by the public order route", () => {
    expect(toDate(EVENING)?.toISOString()).toBe(EVENING);
  });

  it("reads naive strings as UTC regardless of the machine's own timezone", () => {
    // This is the migration-safety property: the same stored string must decode to the
    // same instant on a UTC server and on an IST developer machine. Without the explicit
    // UTC pin, `new Date()` would apply the local offset and shift history by 5h30m.
    expect(toDate("Aug 14, 2026, 03:30 PM")?.toISOString()).toBe(EVENING);
    expect(toDate("2026-08-14T15:30:00")?.toISOString()).toBe(EVENING);
  });

  it("respects an explicit offset when one is present", () => {
    expect(toDate("2026-08-14T21:00:00+05:30")?.toISOString()).toBe(EVENING);
  });

  it("returns unparseable legacy text unchanged instead of a wrong date", () => {
    // Showing the original string is honest; substituting today's date is not.
    expect(formatDateTimeIST("sometime last Tuesday")).toBe("sometime last Tuesday");
  });

  it("falls back for empty and nullish values", () => {
    expect(formatDateTimeIST(null)).toBe("—");
    expect(formatDateTimeIST(undefined)).toBe("—");
    expect(formatDateTimeIST("")).toBe("—");
    expect(formatDateIST(null, "Not set")).toBe("Not set");
  });

  it("rejects invalid Date objects", () => {
    expect(toDate(new Date("nonsense"))).toBeNull();
  });
});

describe("toISTDateKey", () => {
  it("groups by the IST calendar day, not the UTC one", () => {
    // toISOString().slice(0,10) would file this under 2026-08-14; in India it is the 15th.
    expect(toISTDateKey(LATE_NIGHT)).toBe("2026-08-15");
    expect(toISTDateKey(MORNING)).toBe("2026-08-14");
  });

  it("returns an empty string for unusable input", () => {
    expect(toISTDateKey(null)).toBe("");
    expect(toISTDateKey("garbage")).toBe("");
  });
});
