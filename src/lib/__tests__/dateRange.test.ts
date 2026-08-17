import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveRange, describeRange, financialYearLabel } from "../dateRange";

/**
 * Date ranges anchor on the **Indian financial year** (1 April – 31 March), so the boundary
 * cases worth pinning are the ones either side of 1 April — a statement filed for the wrong
 * year is worse than one filed for the wrong month.
 */

const at = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => {
  vi.useRealTimers();
});

describe("financial year boundaries", () => {
  it("treats April as the start of a new financial year", () => {
    at("2026-04-01T10:00:00");
    const range = resolveRange("this_fy");
    expect(new Date(range.from!).getFullYear()).toBe(2026);
    expect(new Date(range.from!).getMonth()).toBe(3); // April
  });

  it("keeps March in the financial year that began the previous April", () => {
    // The case a calendar-year assumption gets wrong: 31 March 2026 belongs to FY 2025-26.
    at("2026-03-31T10:00:00");
    const range = resolveRange("this_fy");
    expect(new Date(range.from!).getFullYear()).toBe(2025);
  });

  it("labels the financial year in the form an accountant writes it", () => {
    at("2026-08-15T10:00:00");
    expect(financialYearLabel()).toBe("FY 2026-27");

    at("2026-02-15T10:00:00");
    expect(financialYearLabel()).toBe("FY 2025-26");
  });

  it("ends the previous financial year on 31 March", () => {
    at("2026-08-15T10:00:00");
    const range = resolveRange("last_fy");

    const from = new Date(range.from!);
    const to = new Date(range.to!);

    expect(from.getFullYear()).toBe(2025);
    expect(from.getMonth()).toBe(3);
    expect(to.getFullYear()).toBe(2026);
    expect(to.getMonth()).toBe(2); // March
    expect(to.getDate()).toBe(31);
  });
});

describe("month presets", () => {
  it("starts this month on the first", () => {
    at("2026-08-15T10:00:00");
    const range = resolveRange("this_month");
    expect(new Date(range.from!).getDate()).toBe(1);
    expect(new Date(range.from!).getMonth()).toBe(7); // August
  });

  it("ends last month on its actual final day", () => {
    at("2026-08-15T10:00:00");
    const range = resolveRange("last_month");
    const to = new Date(range.to!);
    expect(to.getMonth()).toBe(6); // July
    expect(to.getDate()).toBe(31);
  });

  it("handles February in a leap year", () => {
    at("2028-03-10T10:00:00");
    const to = new Date(resolveRange("last_month").to!);
    expect(to.getMonth()).toBe(1);
    expect(to.getDate()).toBe(29);
  });

  it("rolls back across a year boundary", () => {
    at("2027-01-15T10:00:00");
    const from = new Date(resolveRange("last_month").from!);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(11); // December
  });

  it("spans three calendar months for the 3-month preset", () => {
    at("2026-08-15T10:00:00");
    const from = new Date(resolveRange("last_3_months").from!);
    expect(from.getMonth()).toBe(5); // June
    expect(from.getDate()).toBe(1);
  });
});

describe("unbounded and custom ranges", () => {
  it("returns no boundaries for all-time", () => {
    // Not an arbitrary epoch: any fixed start date would quietly exclude older entries from
    // a statement that claims to cover everything.
    const range = resolveRange("all");
    expect(range.from).toBeUndefined();
    expect(range.to).toBeUndefined();
  });

  it("accepts a complete custom range", () => {
    const range = resolveRange("custom", { from: "2026-04-01", to: "2026-06-30" });
    expect(new Date(range.from!).getMonth()).toBe(3);
    expect(new Date(range.to!).getMonth()).toBe(5);
  });

  it("falls back to unbounded when a custom range is half-filled", () => {
    // A half-filled picker must show everything, not an empty statement the customer
    // cannot explain.
    expect(resolveRange("custom", { from: "2026-04-01" }).from).toBeUndefined();
    expect(resolveRange("custom", { to: "2026-06-30" }).from).toBeUndefined();
    expect(resolveRange("custom", {}).from).toBeUndefined();
  });
});

describe("describeRange", () => {
  it("names a preset by its label", () => {
    at("2026-08-15T10:00:00");
    expect(describeRange(resolveRange("this_fy"))).toBe("This financial year");
    expect(describeRange(resolveRange("last_month"))).toBe("Last month");
  });

  it("spells out a custom range as dates", () => {
    const range = resolveRange("custom", { from: "2026-04-01", to: "2026-06-30" });
    expect(describeRange(range)).toBe("2026-04-01 to 2026-06-30");
  });

  it("describes an unbounded range as all time", () => {
    expect(describeRange(resolveRange("all"))).toBe("All time");
    expect(describeRange(resolveRange("custom", {}))).toBe("All time");
  });
});
