import { describe, it, expect } from "vitest";
import {
  computeOrderTaxDetails,
  computeExpectedOrderTotal,
  computeGoodsGrossTotal,
  isOrderTotalAcceptable,
  resolveSellerState,
  ORDER_TOTAL_TOLERANCE,
  DEFAULT_SELLER_STATE,
} from "../orderTotals";

const inclusiveItem = (overrides = {}) => ({
  quantity: 2,
  pricePerUnit: 118,
  product: { gstRate: 18, hsnCode: "3924", priceIncludesGst: true },
  ...overrides,
});

const exclusiveItem = (overrides = {}) => ({
  quantity: 1,
  pricePerUnit: 100,
  product: { gstRate: 18, hsnCode: "3926", priceIncludesGst: false },
  ...overrides,
});

describe("computeOrderTaxDetails", () => {
  it("splits a GST-inclusive line into base and tax", () => {
    const result = computeOrderTaxDetails([inclusiveItem()], "Madhya Pradesh", "Madhya Pradesh");

    // 2 x 118 inclusive of 18% => base 200, tax 36
    expect(result.baseSubtotal).toBeCloseTo(200, 2);
    expect(result.cgst + result.sgst + result.igst).toBeCloseTo(36, 2);
  });

  it("adds tax on top for GST-exclusive pricing", () => {
    const result = computeOrderTaxDetails([exclusiveItem()], "Madhya Pradesh", "Madhya Pradesh");

    expect(result.baseSubtotal).toBeCloseTo(100, 2);
    expect(result.cgst + result.sgst + result.igst).toBeCloseTo(18, 2);
  });

  it("splits tax into CGST+SGST when buyer and seller share a state", () => {
    const result = computeOrderTaxDetails([inclusiveItem()], "Madhya Pradesh", "Madhya Pradesh");

    expect(result.isIntrastate).toBe(true);
    expect(result.cgst).toBeCloseTo(18, 2);
    expect(result.sgst).toBeCloseTo(18, 2);
    expect(result.igst).toBe(0);
  });

  it("charges IGST across state lines", () => {
    const result = computeOrderTaxDetails([inclusiveItem()], "Maharashtra", "Madhya Pradesh");

    expect(result.isIntrastate).toBe(false);
    expect(result.igst).toBeCloseTo(36, 2);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });

  it("compares states case-insensitively", () => {
    const result = computeOrderTaxDetails([inclusiveItem()], "madhya pradesh", "MADHYA PRADESH");
    expect(result.isIntrastate).toBe(true);
  });

  it("groups the breakdown by HSN code", () => {
    const result = computeOrderTaxDetails(
      [inclusiveItem(), exclusiveItem()],
      "Madhya Pradesh",
      "Madhya Pradesh"
    );

    const codes = result.hsnSlabs.map((s) => s.hsnCode).sort();
    expect(codes).toEqual(["3924", "3926"]);
  });

  it("merges lines that share an HSN code", () => {
    const result = computeOrderTaxDetails(
      [inclusiveItem(), inclusiveItem()],
      "Madhya Pradesh",
      "Madhya Pradesh"
    );

    expect(result.hsnSlabs).toHaveLength(1);
    expect(result.hsnSlabs[0].baseAmount).toBeCloseTo(400, 2);
  });

  it("falls back to 18% / HSN 3924 when a product omits tax fields", () => {
    const result = computeOrderTaxDetails(
      [{ quantity: 1, pricePerUnit: 118, product: {} }],
      "Madhya Pradesh",
      "Madhya Pradesh"
    );

    expect(result.hsnSlabs[0].hsnCode).toBe("3924");
    expect(result.hsnSlabs[0].gstRate).toBe(18);
    expect(result.baseSubtotal).toBeCloseTo(100, 2);
  });

  it("returns zeroes for an empty cart", () => {
    const result = computeOrderTaxDetails([], "Madhya Pradesh", "Madhya Pradesh");

    expect(result.baseSubtotal).toBe(0);
    expect(result.hsnSlabs).toEqual([]);
  });
});

describe("computeExpectedOrderTotal", () => {
  const taxDetails = { baseSubtotal: 200, cgst: 18, sgst: 18, igst: 0 };

  it("sums base, tax, shipping and packaging", () => {
    const total = computeExpectedOrderTotal({
      taxDetails,
      shippingCharge: 50,
      packagingCharge: 10,
    });

    expect(total).toBeCloseTo(296, 2);
  });

  it("subtracts the coupon discount", () => {
    const total = computeExpectedOrderTotal({ taxDetails, couponDiscount: 36 });
    expect(total).toBeCloseTo(200, 2);
  });

  it("never returns a negative charge when the discount exceeds the order", () => {
    const total = computeExpectedOrderTotal({ taxDetails, couponDiscount: 10_000 });
    expect(total).toBe(0);
  });

  it("treats omitted charges as zero", () => {
    expect(computeExpectedOrderTotal({ taxDetails })).toBeCloseTo(236, 2);
  });

  it("rounds to two decimals", () => {
    const total = computeExpectedOrderTotal({
      taxDetails: { baseSubtotal: 100 / 3, cgst: 0, sgst: 0, igst: 0 },
    });
    expect(total).toBe(33.33);
  });
});

describe("isOrderTotalAcceptable", () => {
  it("accepts an exact match", () => {
    expect(isOrderTotalAcceptable(236, 236)).toBe(true);
  });

  it("absorbs sub-rupee rounding drift", () => {
    expect(isOrderTotalAcceptable(236, 235.5)).toBe(true);
    expect(isOrderTotalAcceptable(236, 236.4)).toBe(true);
  });

  it("accepts drift exactly at the tolerance boundary", () => {
    expect(isOrderTotalAcceptable(236, 236 - ORDER_TOTAL_TOLERANCE)).toBe(true);
  });

  it("rejects an under-payment beyond tolerance", () => {
    // The attack this guards: a tampered checkout paying ₹1 for a ₹236 order.
    expect(isOrderTotalAcceptable(236, 1)).toBe(false);
  });

  it("rejects an over-payment beyond tolerance", () => {
    expect(isOrderTotalAcceptable(236, 5000)).toBe(false);
  });
});

describe("resolveSellerState", () => {
  it("prefers an explicitly configured state", () => {
    expect(resolveSellerState("Plot 42, Karnataka - 560001", "Gujarat")).toBe("Gujarat");
  });

  it("scrapes the state out of a company address when nothing is configured", () => {
    expect(resolveSellerState("Plot 42, Industrial Hub, Karnataka - 560001")).toBe("Karnataka");
  });

  it("falls back to the default when the address yields nothing", () => {
    expect(resolveSellerState("")).toBe(DEFAULT_SELLER_STATE);
    expect(resolveSellerState(undefined)).toBe(DEFAULT_SELLER_STATE);
  });

  it("ignores a blank configured state", () => {
    expect(resolveSellerState("Plot 42, Karnataka - 560001", "   ")).toBe("Karnataka");
  });
});

describe("computeGoodsGrossTotal", () => {
  it("returns the line total for GST-inclusive pricing", () => {
    // 2 x 118 is already the gross the buyer sees.
    expect(computeGoodsGrossTotal([inclusiveItem()])).toBe(236);
  });

  it("adds the tax on for GST-exclusive pricing", () => {
    // 1 x 100 ex-GST at 18% => 118 gross. Summing pricePerUnit * quantity would have
    // said 100, which is the mismatch that made a valid coupon fail at order submit.
    expect(computeGoodsGrossTotal([exclusiveItem()])).toBe(118);
  });

  it("agrees with the charged total when there are no charges or discounts", () => {
    const items = [inclusiveItem(), exclusiveItem()];
    const taxDetails = computeOrderTaxDetails(items, "Madhya Pradesh", "Madhya Pradesh");

    expect(computeGoodsGrossTotal(items)).toBe(computeExpectedOrderTotal({ taxDetails }));
  });

  it("is unaffected by place of supply", () => {
    // CGST+SGST vs IGST changes how the tax is apportioned, never the total.
    const items = [inclusiveItem(), exclusiveItem()];
    const intrastate = computeOrderTaxDetails(items, "Madhya Pradesh", "Madhya Pradesh");
    const interstate = computeOrderTaxDetails(items, "Karnataka", "Madhya Pradesh");

    expect(computeExpectedOrderTotal({ taxDetails: intrastate })).toBe(
      computeExpectedOrderTotal({ taxDetails: interstate })
    );
    expect(computeGoodsGrossTotal(items)).toBe(computeExpectedOrderTotal({ taxDetails: interstate }));
  });

  it("returns zero for an empty cart", () => {
    expect(computeGoodsGrossTotal([])).toBe(0);
  });
});
