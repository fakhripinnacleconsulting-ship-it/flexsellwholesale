import { describe, it, expect } from "vitest";
import { resolvePrice, resolveMoq, resolvePriceTierName, isPureB2B, isHybridB2CAndB2B } from "../priceTierHelper";

const sampleSubVariant: any = {
  id: "sub-1",
  sku: "TEST-SKU",
  size: "Standard",
  weight: "250g",
  mrp: 20,
  b2cPrice: 10,
  b2bPrice: 5,
  b2bMoq: 5,
  dropshippingPrice: 7,
  stock: 100,
  isActive: true,
};

describe("Price Tier Helper - Hybrid & Pure B2B Rules", () => {
  it("correctly identifies pure B2B vs hybrid accounts", () => {
    expect(isPureB2B(["B2B"])).toBe(true);
    expect(isPureB2B(["B2C", "B2B"])).toBe(false);
    expect(isHybridB2CAndB2B(["B2C", "B2B"])).toBe(true);
    expect(isHybridB2CAndB2B(["B2B"])).toBe(false);
  });

  it("enforces mandatory MOQ for Pure B2B accounts ONLY", () => {
    expect(resolveMoq(sampleSubVariant, ["B2B"])).toBe(5);
    expect(resolveMoq(sampleSubVariant, ["B2C", "B2B"])).toBe(1);
    expect(resolveMoq(sampleSubVariant, ["B2C"])).toBe(1);
    expect(resolveMoq(sampleSubVariant, ["Dropshipping"])).toBe(1);
  });

  it("always charges b2bPrice for Pure B2B accounts", () => {
    expect(resolvePrice(sampleSubVariant, ["B2B"], 1)).toBe(5);
    expect(resolvePrice(sampleSubVariant, ["B2B"], 10)).toBe(5);
    expect(resolvePriceTierName(sampleSubVariant, ["B2B"], 1)).toBe("B2B");
  });

  it("dynamically unlocks b2bPrice for Hybrid accounts when quantity >= b2bMoq", () => {
    // Qty < MOQ (2 < 5) -> charged b2cPrice (10)
    expect(resolvePrice(sampleSubVariant, ["B2C", "B2B"], 2)).toBe(10);
    expect(resolvePriceTierName(sampleSubVariant, ["B2C", "B2B"], 2)).toBe("B2C");

    // Qty >= MOQ (5 >= 5) -> unlocked b2bPrice (5)!
    expect(resolvePrice(sampleSubVariant, ["B2C", "B2B"], 5)).toBe(5);
    expect(resolvePriceTierName(sampleSubVariant, ["B2C", "B2B"], 5)).toBe("B2B");
  });

  it("always charges b2cPrice for Pure B2C accounts regardless of quantity", () => {
    expect(resolvePrice(sampleSubVariant, ["B2C"], 1)).toBe(10);
    expect(resolvePrice(sampleSubVariant, ["B2C"], 10)).toBe(10);
    expect(resolvePriceTierName(sampleSubVariant, ["B2C"], 10)).toBe("B2C");
  });
});
