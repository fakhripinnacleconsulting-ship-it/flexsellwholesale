import { describe, it, expect } from "vitest";
import {
  resolvePrice,
  resolveMoq,
  resolvePriceTierName,
  isPureB2B,
  isHybridB2CAndB2B,
  calculateVolumetricWeightGrams,
  calculateEffectiveUnitWeightGrams,
} from "../priceTierHelper";

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

describe("Volumetric & Effective Weight Calculations", () => {
  it("calculates volumetric weight in grams correctly ((L * B * H) / 5)", () => {
    // (15 * 12 * 8) / 5 = 1440 / 5 = 288 grams (0.288 kg)
    expect(calculateVolumetricWeightGrams(15, 12, 8)).toBe(288);
    // (20 * 20 * 25) / 5 = 10000 / 5 = 2000 grams (2 kg)
    expect(calculateVolumetricWeightGrams(20, 20, 25)).toBe(2000);
  });

  it("returns 0 volumetric weight if any package dimension is missing, zero, negative, or invalid", () => {
    expect(calculateVolumetricWeightGrams(null, 12, 8)).toBe(0);
    expect(calculateVolumetricWeightGrams(15, undefined, 8)).toBe(0);
    expect(calculateVolumetricWeightGrams(15, 12, 0)).toBe(0);
    expect(calculateVolumetricWeightGrams(-5, 12, 8)).toBe(0);
    expect(calculateVolumetricWeightGrams(NaN, 12, 8)).toBe(0);
  });

  it("returns actual weight when actual weight is higher than volumetric weight (Actual-Dominant)", () => {
    // Actual 500g > Volumetric 288g (15x12x8 cm)
    expect(calculateEffectiveUnitWeightGrams(500, 15, 12, 8)).toBe(500);
  });

  it("returns volumetric weight when volumetric weight is higher than actual weight (Volumetric-Dominant)", () => {
    // Volumetric 2000g (20x20x25 cm) > Actual 250g
    expect(calculateEffectiveUnitWeightGrams(250, 20, 20, 25)).toBe(2000);
  });

  it("returns exact weight when actual and volumetric weights are equal", () => {
    // Volumetric 200g (10x10x10 cm = 1000 / 5 = 200g) == Actual 200g
    expect(calculateEffectiveUnitWeightGrams(200, 10, 10, 10)).toBe(200);
  });

  it("safely falls back to actual weight when package dimensions are missing or invalid", () => {
    expect(calculateEffectiveUnitWeightGrams(350, null, null, null)).toBe(350);
    expect(calculateEffectiveUnitWeightGrams(400, 0, 0, 0)).toBe(400);
  });

  it("calculates total line item weight accurately by multiplying effective unit weight by quantity", () => {
    const unitWeight = calculateEffectiveUnitWeightGrams(250, 20, 20, 25); // 2000g
    const qty = 3;
    const totalLineWeight = unitWeight * qty;
    expect(totalLineWeight).toBe(6000); // 6kg (6000g)
  });
});
