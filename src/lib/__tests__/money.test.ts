import { describe, it, expect } from "vitest";
import {
  toPaise,
  toRupees,
  parseAmountToPaise,
  formatPaise,
  formatSignedPaise,
} from "../money";
import { MIN_RECHARGE_PAISE, MAX_RECHARGE_PAISE } from "../advanceBalanceConstants";

describe("toPaise", () => {
  it("converts whole rupees", () => {
    expect(toPaise(500)).toBe(50000);
    expect(toPaise(30000)).toBe(3000000);
  });

  it("converts paise-precision amounts", () => {
    expect(toPaise(12.34)).toBe(1234);
    expect(toPaise(0.01)).toBe(1);
  });

  it("rounds rather than truncating a binary floating-point remainder", () => {
    // 12.345 * 100 is 1234.4999999999998; truncation would silently lose a paisa.
    expect(toPaise(12.345)).toBe(1235);
    // The classic case: 0.1 + 0.2 is 0.30000000000000004.
    expect(toPaise(0.1 + 0.2)).toBe(30);
  });

  it("rejects a non-finite amount", () => {
    expect(() => toPaise(NaN)).toThrow(/non-finite/);
    expect(() => toPaise(Infinity)).toThrow(/non-finite/);
  });
});

describe("toRupees", () => {
  it("converts back", () => {
    expect(toRupees(50000)).toBe(500);
    expect(toRupees(1234)).toBe(12.34);
  });

  it("refuses a fractional paise value", () => {
    // A fractional paise means something upstream skipped toPaise, which is exactly the
    // drift this module exists to prevent.
    expect(() => toRupees(1234.5)).toThrow(/whole number/);
  });

  it("round-trips every amount it is given", () => {
    for (const rupees of [1, 500, 12.34, 99999.99, 200000]) {
      expect(toRupees(toPaise(rupees))).toBe(rupees);
    }
  });
});

describe("parseAmountToPaise", () => {
  it("accepts a number and a numeric string", () => {
    expect(parseAmountToPaise(500)).toBe(50000);
    expect(parseAmountToPaise("500")).toBe(50000);
  });

  it("rejects zero and negative amounts", () => {
    expect(() => parseAmountToPaise(0)).toThrow(/greater than zero/);
    expect(() => parseAmountToPaise(-100)).toThrow(/greater than zero/);
  });

  it("rejects non-numeric input", () => {
    expect(() => parseAmountToPaise("abc")).toThrow(/must be a number/);
    expect(() => parseAmountToPaise(null)).toThrow(/must be a number/);
    expect(() => parseAmountToPaise(undefined)).toThrow(/must be a number/);
    expect(() => parseAmountToPaise({})).toThrow(/must be a number/);
  });

  it("enforces the recharge bounds", () => {
    const bounds = { min: MIN_RECHARGE_PAISE, max: MAX_RECHARGE_PAISE };

    expect(parseAmountToPaise(500, bounds)).toBe(MIN_RECHARGE_PAISE);
    expect(parseAmountToPaise(200000, bounds)).toBe(MAX_RECHARGE_PAISE);

    expect(() => parseAmountToPaise(499, bounds)).toThrow(/at least ₹500/);
    expect(() => parseAmountToPaise(200001, bounds)).toThrow(/cannot exceed ₹2,00,000/);
  });

  it("names the field in its error so the message can be shown as-is", () => {
    expect(() => parseAmountToPaise(0, { label: "Expense amount" })).toThrow(
      /Expense amount must be greater than zero/
    );
  });
});

describe("formatPaise", () => {
  it("groups in the Indian system, not thousands", () => {
    // 1,20,000 rather than 120,000 — the wrong grouping reads as foreign on an invoice.
    expect(formatPaise(toPaise(120000))).toBe("₹1,20,000");
    expect(formatPaise(toPaise(20000000))).toBe("₹2,00,00,000");
  });

  it("shows paise only when there are any", () => {
    expect(formatPaise(toPaise(15000))).toBe("₹15,000");
    expect(formatPaise(toPaise(15000.5))).toBe("₹15,000.5");
  });

  it("can omit the symbol for table cells that carry their own", () => {
    expect(formatPaise(toPaise(15000), { withSymbol: false })).toBe("15,000");
  });

  it("formats zero without falling back to a placeholder", () => {
    // A Advance Balance with no money must read "₹0", never "-" or an empty cell — the customer
    // has to be able to tell an empty Advance Balance from a failed load.
    expect(formatPaise(0)).toBe("₹0");
  });
});

describe("formatSignedPaise", () => {
  it("uses a true minus sign, not a hyphen", () => {
    const debit = formatSignedPaise(toPaise(6000), "debit");
    expect(debit).toBe("−₹6,000");
    expect(debit.startsWith("−")).toBe(true);
    expect(debit.includes("-")).toBe(false);
  });

  it("prefixes credits with a plus", () => {
    expect(formatSignedPaise(toPaise(5000), "credit")).toBe("+₹5,000");
  });

  it("ignores an already-negative amount rather than printing a double sign", () => {
    expect(formatSignedPaise(-toPaise(6000), "debit")).toBe("−₹6,000");
  });
});
