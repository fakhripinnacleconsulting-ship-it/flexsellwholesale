import { SubVariant } from "@/types";

export type PriceTier = "B2C" | "B2B" | "Dropshipping";

export function resolvePrice(sv: SubVariant, tier: PriceTier): number {
  if (!sv) return 0;
  switch (tier) {
    case "B2B":
      return typeof sv.b2bPrice === "number" && sv.b2bPrice > 0 ? sv.b2bPrice : sv.b2cPrice;
    case "Dropshipping":
      return typeof sv.dropshippingPrice === "number" && sv.dropshippingPrice > 0 ? sv.dropshippingPrice : sv.b2cPrice;
    case "B2C":
    default:
      return sv.b2cPrice;
  }
}

export function resolveMoq(sv: SubVariant, tier: PriceTier): number {
  if (!sv) return 1;
  return tier === "B2B" ? (sv.b2bMoq || 1) : 1;
}

export function canPurchase(customerTypes: string[]): boolean {
  if (!customerTypes || customerTypes.length === 0) return true; // fallback
  return customerTypes.includes("B2C") || customerTypes.includes("B2B");
}

export function getPurchasableTiers(customerTypes: string[]): PriceTier[] {
  const tiers: PriceTier[] = [];
  if (!customerTypes || customerTypes.length === 0) return ["B2C"];
  if (customerTypes.includes("B2C")) tiers.push("B2C");
  if (customerTypes.includes("B2B")) tiers.push("B2B");
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
