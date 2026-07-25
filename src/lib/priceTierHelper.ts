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
  heightCm?: number | null
): number {
  const actual = Math.max(0, Number(actualWeightGrams) || 0);
  const volumetric = calculateVolumetricWeightGrams(lengthCm, breadthCm, heightCm);
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
