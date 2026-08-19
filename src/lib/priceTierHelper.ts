import { SubVariant } from "@/types";

export type PriceTier = "B2C" | "B2B" | "Dropshipping";

export function isPureB2B(customerTypes?: string[]): boolean {
  if (!customerTypes || customerTypes.length === 0) return false;
  return customerTypes.includes("B2B") && !customerTypes.includes("B2C");
}

export function isHybridB2CAndB2B(customerTypes?: string[]): boolean {
  if (!customerTypes || customerTypes.length === 0) return false;
  return customerTypes.includes("B2B") && customerTypes.includes("B2C");
}

/**
 * Whether this account is entitled to wholesale pricing.
 *
 * Entitlement lives in `customerTypes` and nowhere else. `upgradeStatus` used to
 * short-circuit this to `true`, which let an account whose upgrade was marked approved
 * but whose `customerTypes` was still `["B2C"]` see B2B prices in the cart — and then get
 * rejected at checkout by the server's price re-verification, which only ever looked at
 * `customerTypes`. Approval must be reflected by the approve route writing `customerTypes`.
 *
 * Accepts either a customer object or a bare `customerTypes` array so that callers on both
 * sides of the wire resolve entitlement identically.
 */
export function isB2bVerified(customer?: any): boolean {
  if (!customer) return false;

  const types = Array.isArray(customer) ? customer : customer.customerTypes;
  const hasWholesaleType =
    Array.isArray(types) && (types.includes("B2B") || types.includes("Dropshipping"));

  // Admins browse at wholesale rates. Order placement resolves pricing from the customer
  // being ordered for, not from the admin's own account.
  if (!Array.isArray(customer) && customer.role === "admin") return true;

  return hasWholesaleType;
}

export function resolveCustomerTier(customerTypes?: string[]): PriceTier {
  if (!customerTypes || customerTypes.length === 0) return "B2C";
  if (isPureB2B(customerTypes)) return "B2B";
  if (customerTypes.includes("Dropshipping") && !customerTypes.includes("B2C") && !customerTypes.includes("B2B")) {
    return "Dropshipping";
  }
  return "B2C";
}

/**
 * The minimum order quantity that applies to this buyer.
 *
 * **A minimum order quantity is a B2B wholesale term and belongs to B2B alone.** The array
 * branch used to read `includes("B2B") || includes("Dropshipping")`, which forced the
 * wholesale MOQ onto every Dropshipping account — and because the object branch checked only
 * B2B, the same customer got a different answer depending on which shape the caller happened
 * to pass. All three shapes now agree.
 *
 * Returns 1 — "no minimum" — for everyone else, so callers can clamp unconditionally against
 * the result without needing their own role test.
 */
export function resolveMoq(sv?: SubVariant, tierOrTypes?: PriceTier | string[] | any): number {
  if (!sv) return 1;

  const moq = sv.b2bMoq || 1;

  if (typeof tierOrTypes === "object" && tierOrTypes !== null && !Array.isArray(tierOrTypes)) {
    // Admins order on a customer's behalf at that customer's terms, not their own.
    if (tierOrTypes.role === "admin") return 1;
    return isPureB2B(tierOrTypes.customerTypes) ? moq : 1;
  }

  if (Array.isArray(tierOrTypes)) {
    return isPureB2B(tierOrTypes) ? moq : 1;
  }

  return tierOrTypes === "B2B" ? moq : 1;
}

/**
 * The quantity this buyer must actually order, given what they asked for.
 *
 * The single place the MOQ decision is made. `cartStore` previously clamped at three
 * different sites and only one of them checked whether the customer was pure B2B, so adding
 * a single unit as a B2C shopper silently became "minimum 50" with a toast reading
 * "MOQ required for B2B orders".
 *
 * Returns the requested quantity unchanged whenever no minimum applies, and reports whether
 * it raised anything so the caller can decide whether to say so.
 */
export function enforceMoq(
  requested: number,
  sv?: SubVariant,
  customerOrTypes?: PriceTier | string[] | any
): { quantity: number; wasRaised: boolean; moq: number } {
  const moq = resolveMoq(sv, customerOrTypes);
  if (moq <= 1 || requested >= moq) {
    return { quantity: requested, wasRaised: false, moq };
  }
  return { quantity: moq, wasRaised: true, moq };
}

/**
 * Normalises the many shapes callers pass (customer object, `customerTypes` array, or a
 * bare tier string) into one entitlement decision.
 *
 * The client passes a customer object while the server passes a `customerTypes` array;
 * routing both through here is what stops the two sides pricing an order differently and
 * failing checkout with "Price verification failed".
 */
export function resolveEntitlement(
  customerOrTier: PriceTier | string[] | any = "B2C"
): { isVerified: boolean; isDropshipper: boolean } {
  if (customerOrTier === "B2B") {
    return { isVerified: true, isDropshipper: false };
  }
  if (customerOrTier === "Dropshipping") {
    return { isVerified: true, isDropshipper: true };
  }
  if (customerOrTier === "B2C") {
    return { isVerified: false, isDropshipper: false };
  }

  const isVerified = isB2bVerified(customerOrTier);
  const types = Array.isArray(customerOrTier) ? customerOrTier : customerOrTier?.customerTypes;
  const isDropshipper =
    isVerified && Array.isArray(types) && types.includes("Dropshipping");

  return { isVerified, isDropshipper };
}

export function resolvePrice(
  sv?: SubVariant,
  customerOrTier: PriceTier | string[] | any = "B2C",
  quantity: number = 1
): number {
  if (!sv) return 0;

  const { isVerified, isDropshipper } = resolveEntitlement(customerOrTier);

  const b2bMoq = sv.b2bMoq || 1;

  if (isDropshipper && typeof sv.dropshippingPrice === "number" && sv.dropshippingPrice > 0) {
    return sv.dropshippingPrice;
  }

  // B2B Wholesale Price qualification: Requires verified B2B status AND quantity >= MOQ
  if (isVerified && quantity >= b2bMoq && typeof sv.b2bPrice === "number" && sv.b2bPrice > 0) {
    return sv.b2bPrice;
  }

  return sv.b2cPrice;
}

/**
 * Every price this buyer is permitted to pay for this line.
 *
 * `resolvePrice` answers a different question — "what should we *show* this customer" — and
 * returns exactly one number: the best rate they qualify for. The order route used that single
 * answer as the *only* acceptable price, so a B2B customer buying a single unit at the retail
 * rate was rejected for paying **too much**:
 *
 *     Price verification failed … Expected ₹499, got ₹650.
 *
 * Paying more than you must is not fraud. Verification needs the *set*, not the best entry.
 *
 * Note what this deliberately does **not** consult: `item.priceTier`. That field arrives from
 * the browser, and branching on it would put an entitlement re-check inside each branch —
 * three places to get right instead of one. Membership of a server-computed set needs no
 * client input at all.
 *
 * MRP is absent on purpose: it is the strikethrough reference, never a rate anything is sold at.
 */
export function allowedPrices(
  sv?: SubVariant,
  customerOrTypes?: PriceTier | string[] | any,
  quantity: number = 1
): number[] {
  if (!sv) return [];

  const { isVerified, isDropshipper } = resolveEntitlement(customerOrTypes);
  const b2bMoq = sv.b2bMoq || 1;

  // Retail is open to everyone, including B2B and Dropshipping accounts.
  const prices: Array<number | undefined> = [sv.b2cPrice];

  // Wholesale needs entitlement *and* the minimum quantity — the same two conditions
  // resolvePrice applies, so the cart and the check cannot disagree about who qualifies.
  if (isVerified && quantity >= b2bMoq) prices.push(sv.b2bPrice);

  if (isDropshipper) prices.push(sv.dropshippingPrice);

  return prices.filter((p): p is number => typeof p === "number" && p > 0);
}

/**
 * Whether a submitted unit price is one this buyer may pay.
 *
 * Uses the same ₹0.05 tolerance the previous single-price check used, which absorbs the
 * rounding that happens when a price crosses the wire as a float.
 */
export function isPriceAllowed(
  submitted: number,
  sv?: SubVariant,
  customerOrTypes?: PriceTier | string[] | any,
  quantity: number = 1
): { ok: true } | { ok: false; allowed: number[] } {
  const allowed = allowedPrices(sv, customerOrTypes, quantity);

  // No priced variant at all — nothing to verify against, so nothing to reject on.
  if (allowed.length === 0) return { ok: true };

  const matches = allowed.some((price) => Math.abs(price - submitted) <= 0.05);
  return matches ? { ok: true } : { ok: false, allowed };
}

export function resolvePriceTierName(
  sv?: SubVariant,
  customerOrTypes?: string[] | any,
  quantity: number = 1
): PriceTier {
  if (!sv) return "B2C";

  const { isVerified, isDropshipper } = resolveEntitlement(customerOrTypes);

  const b2bMoq = sv.b2bMoq || 1;

  if (isDropshipper) return "Dropshipping";
  if (isVerified && quantity >= b2bMoq && typeof sv.b2bPrice === "number" && sv.b2bPrice > 0) {
    return "B2B";
  }

  return "B2C";
}

export function canPurchase(customerTypes: string[]): boolean {
  if (!customerTypes || customerTypes.length === 0) return true; // fallback
  return customerTypes.includes("B2C") || customerTypes.includes("B2B");
}

export function getPurchasableTiers(customerTypes: string[]): PriceTier[] {
  const tiers: PriceTier[] = [];
  if (!customerTypes || customerTypes.length === 0) return ["B2C"];
  if (customerTypes.includes("B2B")) tiers.push("B2B");
  if (customerTypes.includes("B2C")) tiers.push("B2C");
  return tiers;
}

export function calculateShippingByWeight(
  weightGrams: number,
  slabs: { fromGram: number; uptoGram: number; amount: number }[]
): number {
  if (!slabs || slabs.length === 0) return 0;
  const sortedSlabs = [...slabs].sort((a, b) => Number(a.fromGram) - Number(b.fromGram));
  const w = Number(weightGrams) || 0;

  // 1. Exact or range match
  const matched = sortedSlabs.find(s => w >= Number(s.fromGram) && w <= Number(s.uptoGram));
  if (matched) return Number(matched.amount);

  // 2. If weight is less than or equal to smallest slab's starting weight
  if (w <= Number(sortedSlabs[0].fromGram)) {
    return Number(sortedSlabs[0].amount);
  }

  // 3. If weight exceeds the largest slab's max weight
  if (w >= Number(sortedSlabs[sortedSlabs.length - 1].uptoGram)) {
    return Number(sortedSlabs[sortedSlabs.length - 1].amount);
  }

  // 4. Fallback to nearest slab where w <= uptoGram
  const upper = sortedSlabs.find(s => w <= Number(s.uptoGram));
  if (upper) return Number(upper.amount);

  return Number(sortedSlabs[sortedSlabs.length - 1].amount);
}

/**
 * Calculates Volumetric Weight in Grams from package dimensions (in cm).
 * 
 * Standard Volumetric Weight (kg) = (Length * Breadth * Height) / 5000
 * Since weight is internally measured in grams (1 kg = 1000 grams):
 * Volumetric Weight (g) = ((L * B * H) / 5000) * 1000 = (L * B * H) / 5
 * 
 * Returns 0 if any dimension is missing, null, zero, negative, or invalid.
 */
export function calculateVolumetricWeightGrams(
  lengthCm?: number | null,
  breadthCm?: number | null,
  heightCm?: number | null
): number {
  const l = Number(lengthCm);
  const b = Number(breadthCm);
  const h = Number(heightCm);

  if (isNaN(l) || isNaN(b) || isNaN(h) || l <= 0 || b <= 0 || h <= 0) {
    return 0;
  }

  return (l * b * h) / 5;
}

/**
 * Calculates Effective Unit Weight in Grams.
 * 
 * Compares actual product weight (in grams) against calculated volumetric weight (in grams),
 * and returns the higher value: max(actualWeightGrams, volumetricWeightGrams).
 * 
 * Fallback: If dimensions are missing or invalid, volumetric weight evaluates to 0,
 * returning actualWeightGrams safely.
 */
export function calculateEffectiveUnitWeightGrams(
  actualWeightGrams: number,
  lengthCm?: number | null,
  breadthCm?: number | null,
  heightCm?: number | null,
  dimensionsStr?: string | null
): number {
  const actual = Math.max(0, Number(actualWeightGrams) || 0);

  let l = lengthCm;
  let b = breadthCm;
  let h = heightCm;

  if ((!l || !b || !h || l <= 0 || b <= 0 || h <= 0) && dimensionsStr) {
    const parsed = parseDimensionsToCm(dimensionsStr);
    l = l && l > 0 ? l : parsed.lengthCm;
    b = b && b > 0 ? b : parsed.breadthCm;
    h = h && h > 0 ? h : parsed.heightCm;
  }

  const volumetric = Math.round(calculateVolumetricWeightGrams(l, b, h));
  return Math.max(actual, volumetric);
}

/**
 * Safely parses a weight string like "250g", "100g", "1.5kg" into weight in grams.
 * Returns default fallback (250g) if unparseable or empty.
 */
export function parseWeightToGrams(weightStr?: string | null): number {
  if (!weightStr) return 250;
  const clean = String(weightStr).toLowerCase().trim();
  const match = clean.match(/([0-9.]+)\s*(kg|g|gm|gram|grams)?/);
  if (!match) return 250;
  const num = parseFloat(match[1]);
  if (isNaN(num) || num <= 0) return 250;
  const unit = match[2];
  if (unit === "kg") {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}

/**
 * Safely parses a dimension string like "15x12x8 cm" or "15x12x8" into numeric length, breadth, height in cm.
 * Returns fallback values { lengthCm: 15, breadthCm: 12, heightCm: 8 } if unparseable or empty.
 */
export function parseDimensionsToCm(dimStr?: string | null): { lengthCm: number; breadthCm: number; heightCm: number } {
  if (!dimStr) return { lengthCm: 15, breadthCm: 12, heightCm: 8 };
  const clean = String(dimStr).toLowerCase().trim();
  const parts = clean.split(/x|×|\*/).map(p => parseFloat(p.replace(/[^0-9.]/g, "")));
  if (parts.length >= 3 && !parts.slice(0, 3).some(n => isNaN(n) || n <= 0)) {
    return {
      lengthCm: parts[0],
      breadthCm: parts[1],
      heightCm: parts[2],
    };
  } else if (parts.length === 2 && !parts.some(n => isNaN(n) || n <= 0)) {
    return {
      lengthCm: parts[0],
      breadthCm: parts[1],
      heightCm: 1,
    };
  }
  return { lengthCm: 15, breadthCm: 12, heightCm: 8 };
}

export interface CostBreakdownDetails {
  tier: "B2C" | "B2B" | "Dropshipping";
  quantity: number;
  unitBasePrice: number;
  totalProductPrice: number;

  // Tax breakdown
  hsnCode: string;
  gstRate: number;
  priceIncludesGst: boolean;
  unitTaxableAmount: number;
  unitTaxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  totalTaxAmount: number;

  // Weight & Freight breakdown
  actualUnitWeightGrams: number;
  volumetricUnitWeightGrams: number;
  chargeableUnitWeightGrams: number;
  totalChargeableWeightGrams: number;
  appliedWeightType: "actual" | "volumetric";
  estimatedShippingCharge: number;

  // Handling Charge
  unitPackagingCharge: number;
  totalPackagingCharge: number;
  packagingChargeType: "per_unit" | "per_order";

  // Totals
  unitLandedPrice: number;
  totalLandedOrderAmount: number;
  b2bMoq: number;
}

export function calculateDetailedBreakdown(params: {
  product: any;
  variant?: any;
  subVariant?: any;
  tier: "B2C" | "B2B" | "Dropshipping";
  quantity?: number;
  shippingConfig?: any;
}): CostBreakdownDetails {
  const { product, variant, subVariant, tier, shippingConfig } = params;
  const qty = Math.max(1, params.quantity || 1);

  const b2bMoq = subVariant?.b2bMoq || 1;
  const hsnCode = product?.hsnCode || "3924";
  const gstRate = product?.gstRate ?? 18;
  const priceIncludesGst = product?.priceIncludesGst ?? true;

  // Base price per unit
  let unitBasePrice = 0;
  if (subVariant) {
    if (tier === "B2B") unitBasePrice = subVariant.b2bPrice || subVariant.b2cPrice || 0;
    else if (tier === "Dropshipping") unitBasePrice = subVariant.dropshippingPrice || subVariant.b2cPrice || 0;
    else unitBasePrice = subVariant.b2cPrice || 0;
  }

  const totalProductPrice = unitBasePrice * qty;

  // Tax calculation
  let unitTaxableAmount = 0;
  let unitTaxAmount = 0;

  if (unitBasePrice > 0) {
    if (priceIncludesGst) {
      unitTaxableAmount = unitBasePrice / (1 + gstRate / 100);
      unitTaxAmount = unitBasePrice - unitTaxableAmount;
    } else {
      unitTaxableAmount = unitBasePrice;
      unitTaxAmount = unitBasePrice * (gstRate / 100);
    }
  }

  const totalTaxAmount = unitTaxAmount * qty;
  const cgstAmount = totalTaxAmount / 2;
  const sgstAmount = totalTaxAmount / 2;

  // Weight calculations
  const actualUnitWeightGrams = subVariant?.weightGrams ?? parseWeightToGrams(subVariant?.weight || "250g");

  const parsedDim = parseDimensionsToCm(variant?.dimensions);
  const l = (variant?.lengthCm !== undefined && variant?.lengthCm !== null && variant?.lengthCm > 0)
    ? variant.lengthCm
    : parsedDim.lengthCm;
  const b = (variant?.breadthCm !== undefined && variant?.breadthCm !== null && variant?.breadthCm > 0)
    ? variant.breadthCm
    : parsedDim.breadthCm;
  const h = (variant?.heightCm !== undefined && variant?.heightCm !== null && variant?.heightCm > 0)
    ? variant.heightCm
    : parsedDim.heightCm;

  const volumetricUnitWeightGrams = Math.round(calculateVolumetricWeightGrams(l, b, h));
  const chargeableUnitWeightGrams = Math.max(actualUnitWeightGrams, volumetricUnitWeightGrams);
  const totalChargeableWeightGrams = chargeableUnitWeightGrams * qty;
  const appliedWeightType: "actual" | "volumetric" = volumetricUnitWeightGrams > actualUnitWeightGrams ? "volumetric" : "actual";

  // Shipping calculation per customer tier from /admin/shipping configuration
  let estimatedShippingCharge = 0;
  if (shippingConfig) {
    if (tier === "B2B") {
      const b2bFixed = Number(shippingConfig?.b2bFixedCharge) ?? 150;
      estimatedShippingCharge = b2bFixed;
    } else if (tier === "Dropshipping") {
      // Dropshipping shipping is per-unit weight slab charge multiplied by quantity
      const slabs = shippingConfig?.weightSlabs || [];
      const unitShipping = slabs.length > 0 ? calculateShippingByWeight(chargeableUnitWeightGrams, slabs) : 80;
      estimatedShippingCharge = unitShipping * qty;
    } else {
      // B2C Tier uses weight slabs based on total chargeable weight of the order
      const slabs = shippingConfig?.weightSlabs || [];
      estimatedShippingCharge = slabs.length > 0 ? calculateShippingByWeight(totalChargeableWeightGrams, slabs) : 50;
    }
  } else {
    estimatedShippingCharge = tier === "B2B" ? 150 : tier === "Dropshipping" ? (80 * qty) : 50;
  }

  // Handling Charge calculation per_unit vs per_order (Applied to B2B and Dropshipping only; B2C is exempt)
  const packagingChargeType: "per_unit" | "per_order" = subVariant?.packagingChargeType || variant?.packagingChargeType || product?.packagingChargeType || shippingConfig?.packagingChargeType || "per_unit";
  let unitPackagingCharge = 0;
  let totalPackagingCharge = 0;

  if (tier !== "B2C") {
    const rawPackagingAmount = Number(subVariant?.packagingCharge || variant?.packagingCharge || product?.packagingCharge || shippingConfig?.packagingCharge || 0);

    if (packagingChargeType === "per_order") {
      totalPackagingCharge = rawPackagingAmount;
      unitPackagingCharge = rawPackagingAmount / qty;
    } else {
      unitPackagingCharge = rawPackagingAmount;
      totalPackagingCharge = rawPackagingAmount * qty;
    }
  }

  // Landed total
  const unitLandedPrice = (priceIncludesGst ? unitBasePrice : unitBasePrice + unitTaxAmount) + unitPackagingCharge + (estimatedShippingCharge / qty);
  const totalLandedOrderAmount = (priceIncludesGst ? totalProductPrice : totalProductPrice + totalTaxAmount) + totalPackagingCharge + estimatedShippingCharge;

  return {
    tier,
    quantity: qty,
    unitBasePrice,
    totalProductPrice,
    hsnCode,
    gstRate,
    priceIncludesGst,
    unitTaxableAmount,
    unitTaxAmount,
    cgstAmount,
    sgstAmount,
    totalTaxAmount,
    actualUnitWeightGrams,
    volumetricUnitWeightGrams,
    chargeableUnitWeightGrams,
    totalChargeableWeightGrams,
    appliedWeightType,
    estimatedShippingCharge,
    unitPackagingCharge,
    totalPackagingCharge,
    packagingChargeType,
    unitLandedPrice,
    totalLandedOrderAmount,
    b2bMoq,
  };
}
