export const parseWeightToGrams = (weightStr: string): number => {
  if (!weightStr) return 0;
  const clean = weightStr.toLowerCase().trim();
  const num = parseFloat(clean.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  if (clean.includes("kg")) {
    return num * 1000;
  }
  return num;
};

export const calculateTotalShippingCharge = (
  items: any[],
  shippingConfig: any,
  calculateShippingByWeight: (grams: number, slabs: any[]) => number,
  calculateEffectiveUnitWeightGrams: (actualGrams: number, length?: number, breadth?: number, height?: number, dimensions?: any) => number
): number => {
  if (!shippingConfig || !items || items.length === 0) return 0;

  const b2cWeightGrams = items
    .filter(item => item.priceTier !== "B2B")
    .reduce((sum, item) => {
      const matchingColor = item.selectedVariants?.["Color"] || item.selectedVariants?.["color"] || item.selectedVariants?.["Varient Line #"] || item.selectedVariants?.["Variant Line #"] || Object.values(item.selectedVariants || {})[0];
      const activeVariant = item.product?.colorVariants?.find((cv: any) => cv.color === matchingColor)
        || item.product?.colorVariants?.[0];
      const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
        (!item.selectedVariants?.["Size"] || sv.size === item.selectedVariants["Size"]) &&
        (!item.selectedVariants?.["Weight"] || sv.weight === item.selectedVariants["Weight"])
      ) || activeVariant?.subVariants?.[0];
      
      const unitWeightStr = activeSubVariant?.weight || "0g";
      const actualUnitWeightGrams = activeSubVariant?.weightGrams ?? parseWeightToGrams(unitWeightStr);
      
      // Handle both dimensions object or individual fields
      const effectiveUnitWeight = calculateEffectiveUnitWeightGrams(
        actualUnitWeightGrams,
        activeVariant?.lengthCm,
        activeVariant?.breadthCm,
        activeVariant?.heightCm,
        activeVariant?.dimensions
      );
      
      return sum + (effectiveUnitWeight * item.quantity);
    }, 0);

  const hasB2B = items.some(item => item.priceTier === "B2B");
  const hasB2C = items.some(item => item.priceTier !== "B2B");

  const b2bFixed = shippingConfig?.b2bFixedCharge ?? 150;
  const slabs = shippingConfig?.weightSlabs || [];

  const b2bShipping = hasB2B ? b2bFixed : 0;
  const b2cShipping = hasB2C ? calculateShippingByWeight(b2cWeightGrams, slabs) : 0;

  return b2bShipping + b2cShipping;
};
