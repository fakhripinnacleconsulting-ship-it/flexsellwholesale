export function resolveVariantKeys(selectedVariants: Record<string, string> | undefined | null) {
  if (!selectedVariants) {
    return { color: "Default", size: "", weight: "" };
  }

  // Look for any case variations or standard B2B key names
  const color = selectedVariants["Color"] || selectedVariants["color"] || "Default";
  const size = selectedVariants["Pack Sizing"] || selectedVariants["Size"] || selectedVariants["size"] || "";
  const weight = selectedVariants["Weight Unit"] || selectedVariants["Weight"] || selectedVariants["weight"] || "";

  return { color, size, weight };
}
