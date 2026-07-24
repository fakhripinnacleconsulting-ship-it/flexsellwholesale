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
