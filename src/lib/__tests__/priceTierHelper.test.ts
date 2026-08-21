import { describe, it, expect } from "vitest";
import {
  resolvePrice,
  resolveMoq,
  resolvePriceTierName,
  isPureB2B,
  isHybridB2CAndB2B,
  calculateVolumetricWeightGrams,
  calculateEffectiveUnitWeightGrams,
  calculateDetailedBreakdown,
  enforceMoq,
  allowedPrices,
  isPriceAllowed,
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

describe("Price Tier Helper - B2B Qualification Rules", () => {
  const approvedB2bCustomer = { role: "customer", customerTypes: ["B2B"], upgradeStatus: "approved" };
  const b2bCustomerNoStatus = { role: "customer", customerTypes: ["B2B"], upgradeStatus: "none" };
  const pendingUpgradeCustomer = { role: "customer", customerTypes: ["B2C"], upgradeStatus: "pending", upgradeRequestedTypes: ["B2B"] };
  const b2cCustomer = { role: "customer", customerTypes: ["B2C"], upgradeStatus: "none" };

  it("correctly identifies pure B2B vs hybrid accounts", () => {
    expect(isPureB2B(["B2B"])).toBe(true);
    expect(isPureB2B(["B2C", "B2B"])).toBe(false);
    expect(isHybridB2CAndB2B(["B2C", "B2B"])).toBe(true);
    expect(isHybridB2CAndB2B(["B2B"])).toBe(false);
  });

  it("enforces mandatory MOQ for Verified B2B accounts ONLY", () => {
    expect(resolveMoq(sampleSubVariant, approvedB2bCustomer)).toBe(5);
    expect(resolveMoq(sampleSubVariant, b2bCustomerNoStatus)).toBe(5);
    expect(resolveMoq(sampleSubVariant, pendingUpgradeCustomer)).toBe(1);
    expect(resolveMoq(sampleSubVariant, b2cCustomer)).toBe(1);
  });

  it("applies B2B price for B2B accounts when qty >= MOQ", () => {
    expect(resolvePrice(sampleSubVariant, approvedB2bCustomer, 5)).toBe(5);
    expect(resolvePriceTierName(sampleSubVariant, approvedB2bCustomer, 5)).toBe("B2B");

    expect(resolvePrice(sampleSubVariant, b2bCustomerNoStatus, 5)).toBe(5);
    expect(resolvePriceTierName(sampleSubVariant, b2bCustomerNoStatus, 5)).toBe("B2B");
  });

  it("applies B2C price for B2B accounts when qty < MOQ", () => {
    expect(resolvePrice(sampleSubVariant, approvedB2bCustomer, 2)).toBe(10);
    expect(resolvePriceTierName(sampleSubVariant, approvedB2bCustomer, 2)).toBe("B2C");
  });

  it("always charges B2C price if B2B upgrade request is pending or unapproved", () => {
    expect(resolvePrice(sampleSubVariant, pendingUpgradeCustomer, 2)).toBe(10);
    expect(resolvePrice(sampleSubVariant, pendingUpgradeCustomer, 10)).toBe(10);
    expect(resolvePriceTierName(sampleSubVariant, pendingUpgradeCustomer, 10)).toBe("B2C");
  });

  it("always charges b2cPrice for B2C accounts regardless of quantity", () => {
    expect(resolvePrice(sampleSubVariant, b2cCustomer, 1)).toBe(10);
    expect(resolvePrice(sampleSubVariant, b2cCustomer, 10)).toBe(10);
    expect(resolvePriceTierName(sampleSubVariant, b2cCustomer, 10)).toBe("B2C");
  });

  // Regression: an account left at customerTypes ["B2C"] with upgradeStatus "approved"
  // priced as B2B in the cart but as B2C on the server, so every checkout died with
  // "Price verification failed". Entitlement now comes from customerTypes alone.
  describe("client and server must resolve the same price", () => {
    const staleApproved = {
      role: "customer",
      customerTypes: ["B2C"],
      upgradeStatus: "approved",
    };

    it("does not grant B2B pricing on upgradeStatus alone", () => {
      expect(resolvePrice(sampleSubVariant, staleApproved, 10)).toBe(10);
      expect(resolvePriceTierName(sampleSubVariant, staleApproved, 10)).toBe("B2C");
    });

    it("agrees whether given a customer object or a customerTypes array", () => {
      const cases = [
        { role: "customer", customerTypes: ["B2C"], upgradeStatus: "approved" },
        { role: "customer", customerTypes: ["B2C"], upgradeStatus: "pending" },
        { role: "customer", customerTypes: ["B2B"], upgradeStatus: "none" },
        { role: "customer", customerTypes: ["B2C", "B2B"], upgradeStatus: "approved" },
        { role: "customer", customerTypes: ["Dropshipping"], upgradeStatus: "none" },
        { role: "customer", customerTypes: [], upgradeStatus: "none" },
      ];

      for (const customer of cases) {
        for (const qty of [1, 5, 20]) {
          // Client passes the object; the server only has customerTypes.
          expect(
            resolvePrice(sampleSubVariant, customer, qty),
            `price mismatch for ${JSON.stringify(customer.customerTypes)} @ qty ${qty}`
          ).toBe(resolvePrice(sampleSubVariant, customer.customerTypes, qty));

          expect(
            resolvePriceTierName(sampleSubVariant, customer, qty),
            `tier mismatch for ${JSON.stringify(customer.customerTypes)} @ qty ${qty}`
          ).toBe(resolvePriceTierName(sampleSubVariant, customer.customerTypes, qty));
        }
      }
    });

    it("keeps MOQ consistent across both shapes", () => {
      const b2b = { role: "customer", customerTypes: ["B2B"], upgradeStatus: "approved" };
      expect(resolveMoq(sampleSubVariant, b2b)).toBe(resolveMoq(sampleSubVariant, b2b.customerTypes));
    });

    it("still prices Dropshipping accounts at the dropshipping rate", () => {
      const dropshipper = { role: "customer", customerTypes: ["Dropshipping"], upgradeStatus: "approved" };
      expect(resolvePrice(sampleSubVariant, dropshipper, 1)).toBe(7);
      expect(resolvePriceTierName(sampleSubVariant, dropshipper, 1)).toBe("Dropshipping");
    });
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

  it("parses dimensionsStr when length/breadth/height are missing or 0", () => {
    expect(calculateEffectiveUnitWeightGrams(100, undefined, undefined, undefined, "15x12x20.9 cm")).toBe(752);
  });

  it("calculates total line item weight accurately by multiplying effective unit weight by quantity", () => {
    const unitWeight = calculateEffectiveUnitWeightGrams(250, 20, 20, 25); // 2000g
    const qty = 3;
    const totalLineWeight = unitWeight * qty;
    expect(totalLineWeight).toBe(6000); // 6kg (6000g)
  });
});

describe("calculateDetailedBreakdown", () => {
  const dummyProduct = {
    _id: "prod-1",
    title: "Test Badge Product",
    hsnCode: "3924",
    gstRate: 18,
    priceIncludesGst: true,
    packagingCharge: 10,
  };

  const dummyVariant = {
    color: "Default",
    dimensions: "15x12x20.9 cm",
    lengthCm: 15,
    breadthCm: 12,
    heightCm: 20.9,
  };

  const dummySubVariant = {
    id: "sv-1",
    size: "Standard",
    weight: "100g",
    weightGrams: 100,
    b2cPrice: 15,
    b2bPrice: 10,
    dropshippingPrice: 12,
    b2bMoq: 10,
    packagingCharge: 5,
  };

  it("calculates detailed breakdown correctly for B2C tier", () => {
    const breakdown = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "B2C",
      quantity: 2,
    });

    expect(breakdown.tier).toBe("B2C");
    expect(breakdown.quantity).toBe(2);
    expect(breakdown.unitBasePrice).toBe(15);
    expect(breakdown.totalProductPrice).toBe(30);
    expect(breakdown.unitPackagingCharge).toBe(0); // B2C is exempt from Handling Charges
    expect(breakdown.totalPackagingCharge).toBe(0);
    expect(breakdown.appliedWeightType).toBe("volumetric"); // Volumetric 752g > Actual 100g
    expect(breakdown.chargeableUnitWeightGrams).toBe(752);
  });

  it("calculates detailed breakdown correctly for B2B tier with MOQ", () => {
    const breakdown = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "B2B",
      quantity: 10,
    });

    expect(breakdown.tier).toBe("B2B");
    expect(breakdown.quantity).toBe(10);
    expect(breakdown.unitBasePrice).toBe(10);
    expect(breakdown.totalProductPrice).toBe(100);
    expect(breakdown.b2bMoq).toBe(10);
    expect(breakdown.totalPackagingCharge).toBe(50);
  });

  it("calculates per_order flat Handling Charge correctly", () => {
    const breakdown = calculateDetailedBreakdown({
      product: { ...dummyProduct, packagingCharge: 50, packagingChargeType: "per_order" },
      variant: dummyVariant,
      subVariant: { ...dummySubVariant, packagingCharge: 50, packagingChargeType: "per_order" },
      tier: "B2B",
      quantity: 5,
    });

    expect(breakdown.packagingChargeType).toBe("per_order");
    expect(breakdown.totalPackagingCharge).toBe(50); // Flat ₹50 for whole order
    expect(breakdown.unitPackagingCharge).toBe(10); // ₹50 / 5 units
  });

  it("falls back to variant/product Handling Charge when subVariant has 0", () => {
    const breakdown = calculateDetailedBreakdown({
      product: { ...dummyProduct, packagingCharge: 40 },
      variant: { ...dummyVariant, packagingCharge: 25 },
      subVariant: { ...dummySubVariant, packagingCharge: 0 },
      tier: "B2B",
      quantity: 2,
    });

    expect(breakdown.unitPackagingCharge).toBe(25); // Picked variant Handling Charge
    expect(breakdown.totalPackagingCharge).toBe(50);
  });

  it("calculates dynamic weight-based shipping for Dropshipping tier when dropshippingFixedCharge is 0", () => {
    const shippingConfig = {
      b2bFixedCharge: 150,
      dropshippingFixedCharge: 0,
      weightSlabs: [
        { fromGram: 0, uptoGram: 500, amount: 60 },
        { fromGram: 501, uptoGram: 2000, amount: 120 },
      ],
    };

    // 1 unit chargeable weight = 752g (volumetric) -> slab 501-2000g = 120
    const breakdownQty1 = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "Dropshipping",
      quantity: 1,
      shippingConfig,
    });
    expect(breakdownQty1.estimatedShippingCharge).toBe(120);

    // 2 units: 1 unit chargeable weight = 752g (slab 501-2000g = 120) * 2 qty = 240
    const breakdownQty2 = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "Dropshipping",
      quantity: 2,
      shippingConfig,
    });
    expect(breakdownQty2.estimatedShippingCharge).toBe(240);
  });

  it("scales Dropshipping shipping charge proportionally with quantity (e.g. 1 qty = Rs.50, 3 qty = Rs.150)", () => {
    const shippingConfig = {
      b2bFixedCharge: 150,
      dropshippingFixedCharge: 0,
      weightSlabs: [
        { fromGram: 0, uptoGram: 1000, amount: 50 },
      ],
    };

    const breakdown1 = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "Dropshipping",
      quantity: 1,
      shippingConfig,
    });
    expect(breakdown1.estimatedShippingCharge).toBe(50);

    const breakdown3 = calculateDetailedBreakdown({
      product: dummyProduct,
      variant: dummyVariant,
      subVariant: dummySubVariant,
      tier: "Dropshipping",
      quantity: 3,
      shippingConfig,
    });
    expect(breakdown3.estimatedShippingCharge).toBe(150);
  });
});

/**
 * B-5 regression.
 *
 * Two bugs compounded here. `resolveMoq`'s array branch read
 * `includes("B2B") || includes("Dropshipping")`, so Dropshipping accounts inherited the
 * wholesale minimum; and because the object branch tested only B2B, the same customer got a
 * different answer depending on which shape the caller happened to pass. Meanwhile cartStore
 * clamped at three sites and only one of them checked pure-B2B, so a B2C shopper adding one
 * unit had it silently raised — with a toast reading "MOQ required for B2B orders".
 */
describe("MOQ applies to verified B2B only", () => {
  const sv: any = { ...sampleSubVariant, b2bMoq: 50 };

  it.each([
    ["pure B2C", ["B2C"]],
    ["pure Dropshipping", ["Dropshipping"]],
    ["B2C + Dropshipping", ["B2C", "Dropshipping"]],
    ["hybrid B2C + B2B", ["B2C", "B2B"]],
  ])("does not impose a minimum on %s", (_label, types) => {
    expect(resolveMoq(sv, types as string[])).toBe(1);
    expect(enforceMoq(1, sv, types as string[])).toEqual({ quantity: 1, wasRaised: false, moq: 1 });
  });

  it("imposes the minimum on a pure B2B account", () => {
    expect(resolveMoq(sv, ["B2B"])).toBe(50);
    expect(enforceMoq(1, sv, ["B2B"])).toEqual({ quantity: 50, wasRaised: true, moq: 50 });
  });

  it("agrees across all three input shapes", () => {
    // The array, the customer object and the bare tier string must reach the same verdict —
    // they previously did not, which is what made the bug depend on the call site.
    expect(resolveMoq(sv, ["Dropshipping"])).toBe(1);
    expect(resolveMoq(sv, { customerTypes: ["Dropshipping"] })).toBe(1);
    expect(resolveMoq(sv, "Dropshipping" as any)).toBe(1);

    expect(resolveMoq(sv, ["B2B"])).toBe(50);
    expect(resolveMoq(sv, { customerTypes: ["B2B"] })).toBe(50);
    expect(resolveMoq(sv, "B2B" as any)).toBe(50);
  });

  it("leaves an admin unclamped — they order at the customer's terms, not their own", () => {
    expect(resolveMoq(sv, { role: "admin", customerTypes: ["B2B"] })).toBe(1);
  });

  it("never lowers a quantity that already meets the minimum", () => {
    expect(enforceMoq(80, sv, ["B2B"])).toEqual({ quantity: 80, wasRaised: false, moq: 50 });
  });
});

/**
 * Order price verification.
 *
 * The order route used to compare the submitted price against `resolvePrice` — a single
 * number, the *best* rate the buyer qualifies for. A B2B customer who chose to buy one unit at
 * the retail price was therefore rejected for paying too much:
 *
 *     Price verification failed … Expected ₹499, got ₹650.
 *
 * Verification needs the whole set of prices the buyer may pay, not the best entry.
 */
describe("allowedPrices / isPriceAllowed", () => {
  // MRP 1000, retail 650, wholesale 499, dropship 550, MOQ 1 — the common shape, and the one
  // that reproduces the bug: with b2bMoq of 1 a B2B buyer always qualified for ₹499.
  const sv: any = { ...sampleSubVariant, mrp: 1000, b2cPrice: 650, b2bPrice: 499, dropshippingPrice: 550, b2bMoq: 1 };

  it("lets a B2B customer buy a single unit at the retail price", () => {
    expect(isPriceAllowed(650, sv, ["B2B"], 1).ok).toBe(true);
  });

  it("lets a B2B customer buy at the wholesale price", () => {
    expect(isPriceAllowed(499, sv, ["B2B"], 1).ok).toBe(true);
  });

  it("blocks a B2C customer claiming the wholesale price", () => {
    const verdict = isPriceAllowed(499, sv, ["B2C"], 1);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.allowed).toEqual([650]);
  });

  it("blocks a B2C customer claiming the dropship price", () => {
    expect(isPriceAllowed(550, sv, ["B2C"], 1).ok).toBe(false);
  });

  it("lets a dropshipper pay the dropship price, and retail too", () => {
    expect(isPriceAllowed(550, sv, ["Dropshipping"], 1).ok).toBe(true);
    expect(isPriceAllowed(650, sv, ["Dropshipping"], 1).ok).toBe(true);
  });

  it("blocks a tampered price for everyone", () => {
    for (const types of [["B2C"], ["B2B"], ["Dropshipping"]]) {
      expect(isPriceAllowed(100, sv, types, 1).ok).toBe(false);
    }
  });

  it("withholds the wholesale price below the minimum quantity", () => {
    const withMoq: any = { ...sv, b2bMoq: 50 };
    expect(isPriceAllowed(499, withMoq, ["B2B"], 10).ok).toBe(false);
    expect(isPriceAllowed(499, withMoq, ["B2B"], 50).ok).toBe(true);
    // Retail stays available at any quantity.
    expect(isPriceAllowed(650, withMoq, ["B2B"], 10).ok).toBe(true);
  });

  it("never offers MRP as a purchasable price", () => {
    // MRP is the strikethrough reference. Nothing is ever sold at it.
    expect(allowedPrices(sv, ["B2B"], 1)).not.toContain(1000);
    expect(isPriceAllowed(1000, sv, ["B2B"], 1).ok).toBe(false);
  });

  it("treats a guest as B2C", () => {
    expect(isPriceAllowed(650, sv, undefined, 1).ok).toBe(true);
    expect(isPriceAllowed(499, sv, undefined, 1).ok).toBe(false);
  });

  it("accepts a rounding difference within half a paisa", () => {
    expect(isPriceAllowed(650.04, sv, ["B2C"], 1).ok).toBe(true);
    expect(isPriceAllowed(650.5, sv, ["B2C"], 1).ok).toBe(false);
  });

  it("verifies nothing when the variant has no usable price", () => {
    // Nothing to compare against is not the same as a violation.
    const empty: any = { ...sampleSubVariant, b2cPrice: 0, b2bPrice: 0, dropshippingPrice: 0 };
    expect(isPriceAllowed(123, empty, ["B2C"], 1).ok).toBe(true);
  });
});
