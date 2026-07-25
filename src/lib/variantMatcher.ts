export function resolveVariantKeys(selectedVariants: Record<string, string> | undefined | null) {
  if (!selectedVariants || Object.keys(selectedVariants).length === 0) {
    return { color: "Default", size: "", weight: "" };
  }

  // Look for any case variations or standard B2B key names (including custom labels like Varient Line #, Variation Type)
  const color = selectedVariants["Color"] ||
    selectedVariants["color"] ||
    selectedVariants["Variation Type"] ||
    selectedVariants["Varient Line #"] ||
    selectedVariants["Variant Line #"] ||
    selectedVariants["Varient"] ||
    selectedVariants["Variant"] ||
    Object.values(selectedVariants)[0] ||
    "Default";

  const size = selectedVariants["Pack Sizing"] || selectedVariants["Select Pack"] || selectedVariants["Size"] || selectedVariants["size"] || "";
  const weight = selectedVariants["Weight Unit"] || selectedVariants["Weight"] || selectedVariants["weight"] || "";

  return { color, size, weight };
}
