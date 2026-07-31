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

  const slabs = shippingConfig?.weightSlabs || [];
  const b2bFixed = shippingConfig?.b2bFixedCharge ?? 150;

  let hasB2B = false;
  let b2cWeightGrams = 0;
  let dropshippingShipping = 0;

  items.forEach((item) => {
    const tier = item.priceTier || "B2C";

    if (tier === "B2B") {
      hasB2B = true;
      return;
    }

    const matchingColor =
      item.selectedVariants?.["Color"] ||
      item.selectedVariants?.["color"] ||
      item.selectedVariants?.["Varient Line #"] ||
      item.selectedVariants?.["Variant Line #"] ||
      Object.values(item.selectedVariants || {})[0];

    const activeVariant =
      item.product?.colorVariants?.find((cv: any) => cv.color === matchingColor) ||
      item.product?.colorVariants?.[0];

    const activeSubVariant =
      activeVariant?.subVariants?.find(
        (sv: any) =>
          (!item.selectedVariants?.["Size"] || sv.size === item.selectedVariants["Size"]) &&
          (!item.selectedVariants?.["Weight"] || sv.weight === item.selectedVariants["Weight"])
      ) || activeVariant?.subVariants?.[0];

    const itemWeightStr = item.weight || activeSubVariant?.weight || "500g";
    const actualUnitWeightGrams =
      item.weightGrams ??
      activeSubVariant?.weightGrams ??
      ((itemWeightStr !== "N/A" ? parseWeightToGrams(itemWeightStr) : 500) || 500);

    const effectiveUnitWeight = calculateEffectiveUnitWeightGrams(
      actualUnitWeightGrams,
      activeVariant?.lengthCm,
      activeVariant?.breadthCm,
      activeVariant?.heightCm,
      activeVariant?.dimensions
    );

    const qty = Number(item.quantity || 1);

    if (tier === "Dropshipping") {
      const unitShipping = slabs.length > 0 ? calculateShippingByWeight(effectiveUnitWeight, slabs) : 80;
      dropshippingShipping += unitShipping * qty;
    } else {
      b2cWeightGrams += effectiveUnitWeight * qty;
    }
  });

  const b2bShipping = hasB2B ? b2bFixed : 0;
  const b2cShipping = b2cWeightGrams > 0 ? calculateShippingByWeight(b2cWeightGrams, slabs) : 0;

  return b2bShipping + b2cShipping + dropshippingShipping;
};
