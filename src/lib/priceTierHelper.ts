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

export function resolveCustomerTier(customerTypes?: string[]): PriceTier {
  if (!customerTypes || customerTypes.length === 0) return "B2C";
  if (isPureB2B(customerTypes)) return "B2B";
  if (customerTypes.includes("Dropshipping") && !customerTypes.includes("B2C") && !customerTypes.includes("B2B")) {
    return "Dropshipping";
  }
  return "B2C";
}

export function resolveMoq(sv?: SubVariant, tierOrTypes?: PriceTier | string[]): number {
  if (!sv) return 1;

  if (Array.isArray(tierOrTypes)) {
    // Only pure B2B accounts have mandatory MOQ!
    return isPureB2B(tierOrTypes) ? (sv.b2bMoq || 1) : 1;
  }

  // If explicit PriceTier string passed:
  return tierOrTypes === "B2B" ? (sv.b2bMoq || 1) : 1;
}

export function resolvePrice(
  sv?: SubVariant,
  tierOrTypes: PriceTier | string[] = "B2C",
  quantity: number = 1
): number {
  if (!sv) return 0;

  if (Array.isArray(tierOrTypes)) {
    const types = tierOrTypes;
    if (isPureB2B(types)) {
      return typeof sv.b2bPrice === "number" && sv.b2bPrice > 0 ? sv.b2bPrice : sv.b2cPrice;
    }
    if (isHybridB2CAndB2B(types)) {
      const b2bMoq = sv.b2bMoq || 1;
      // If hybrid buyer orders >= b2bMoq, unlock B2B wholesale price!
      if (quantity >= b2bMoq && typeof sv.b2bPrice === "number" && sv.b2bPrice > 0) {
        return sv.b2bPrice;
      }
      return sv.b2cPrice;
    }
    if (types.includes("Dropshipping")) {
      return typeof sv.dropshippingPrice === "number" && sv.dropshippingPrice > 0
        ? sv.dropshippingPrice
        : sv.b2cPrice;
    }
    return sv.b2cPrice;
  }

  // Explicit PriceTier string
  switch (tierOrTypes) {
    case "B2B":
      return typeof sv.b2bPrice === "number" && sv.b2bPrice > 0 ? sv.b2bPrice : sv.b2cPrice;
    case "Dropshipping":
      return typeof sv.dropshippingPrice === "number" && sv.dropshippingPrice > 0
        ? sv.dropshippingPrice
        : sv.b2cPrice;
    case "B2C":
    default:
      return sv.b2cPrice;
  }
}

export function resolvePriceTierName(
  sv?: SubVariant,
  customerTypes?: string[],
  quantity: number = 1
): PriceTier {
  if (!sv || !customerTypes || customerTypes.length === 0) return "B2C";
  if (isPureB2B(customerTypes)) return "B2B";
  if (isHybridB2CAndB2B(customerTypes)) {
    const b2bMoq = sv.b2bMoq || 1;
    return quantity >= b2bMoq && typeof sv.b2bPrice === "number" && sv.b2bPrice > 0 ? "B2B" : "B2C";
  }
  if (customerTypes.includes("Dropshipping")) return "Dropshipping";
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
  const slab = slabs.find(s => weightGrams >= s.fromGram && weightGrams <= s.uptoGram);
  return slab ? slab.amount : 0;
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
  
  // Packaging charge
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
      if (typeof shippingConfig?.dropshippingFixedCharge === "number" && shippingConfig.dropshippingFixedCharge > 0) {
        estimatedShippingCharge = shippingConfig.dropshippingFixedCharge;
      } else {
        const slabs = shippingConfig?.weightSlabs || [];
        estimatedShippingCharge = slabs.length > 0 ? calculateShippingByWeight(totalChargeableWeightGrams, slabs) : 80;
      }
    } else {
      // B2C Tier uses weight slabs from /admin/shipping
      const slabs = shippingConfig?.weightSlabs || [];
      estimatedShippingCharge = slabs.length > 0 ? calculateShippingByWeight(totalChargeableWeightGrams, slabs) : 50;
    }
  } else {
    estimatedShippingCharge = tier === "B2B" ? 150 : tier === "Dropshipping" ? 80 : 50;
  }

  // Packaging charge calculation per_unit vs per_order (Applied to B2B and Dropshipping only; B2C is exempt)
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
