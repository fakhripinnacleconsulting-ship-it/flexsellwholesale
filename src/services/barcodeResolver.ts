import { Product, ColorVariant, SubVariant } from "@/types";
import { resolvePrice } from "@/lib/priceTierHelper";

export interface BarcodeResolutionResult {
  success: boolean;
  matchType: "subvariant_sku" | "subvariant_barcode" | "product_barcode" | "product_id" | "fuzzy" | "none";
  product?: Product;
  colorVariant?: ColorVariant;
  subVariant?: SubVariant;
  exactSku?: string;
  matchedPrice?: number;
  availableStock?: number;
  warehouseLocation?: string;
  error?: string;
}

/**
 * Resolves a scanned or pasted raw barcode string to an exact Product, ColorVariant, and SubVariant.
 */
export function resolveBarcode(
  rawInput: string,
  catalog: Product[],
  customerType: "B2C" | "B2B" | "Dropshipping" = "B2C"
): BarcodeResolutionResult {
  const cleaned = (rawInput || "").trim().replace(/[\r\n\t]/g, "").toUpperCase();
  if (!cleaned) {
    return { success: false, matchType: "none", error: "Empty barcode query" };
  }

  // Search 1: Exact match on SubVariant SKU or SubVariant barcode
  for (const product of catalog) {
    for (const cv of product.colorVariants || []) {
      for (const sv of cv.subVariants || []) {
        const matchesSku = sv.sku && sv.sku.toUpperCase() === cleaned;
        const matchesBarcode = sv.barcode && sv.barcode.toUpperCase() === cleaned;

        if (matchesSku || matchesBarcode) {
          const matchedPrice = resolvePrice(sv, customerType);
          return {
            success: true,
            matchType: matchesSku ? "subvariant_sku" : "subvariant_barcode",
            product,
            colorVariant: cv,
            subVariant: sv,
            exactSku: sv.sku,
            matchedPrice,
            availableStock: sv.stock,
            warehouseLocation: getWarehouseLocation(product.categoryId)
          };
        }
      }
    }
  }

  // Search 2: Exact match on Product-level barcode, _id, or slug
  for (const product of catalog) {
    const matchesProductBc = product.barcode && product.barcode.toUpperCase() === cleaned;
    const matchesId = product._id.toUpperCase() === cleaned;
    const matchesSlug = product.slug.toUpperCase() === cleaned;

    if (matchesProductBc || matchesId || matchesSlug) {
      const cv = product.colorVariants?.[0];
      const sv = cv?.subVariants?.[0];
      if (cv && sv) {
        const matchedPrice = resolvePrice(sv, customerType);
        return {
          success: true,
          matchType: matchesProductBc ? "product_barcode" : "product_id",
          product,
          colorVariant: cv,
          subVariant: sv,
          exactSku: sv.sku,
          matchedPrice,
          availableStock: sv.stock,
          warehouseLocation: getWarehouseLocation(product.categoryId)
        };
      }
    }
  }

  // Search 3: Normalized/Fuzzy match (ignoring special delimiters)
  const strippedCleaned = cleaned.replace(/[^A-Z0-9]/g, "");
  if (strippedCleaned.length >= 3) {
    for (const product of catalog) {
      for (const cv of product.colorVariants || []) {
        for (const sv of cv.subVariants || []) {
          const strippedSku = sv.sku ? sv.sku.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";
          const strippedBc = sv.barcode ? sv.barcode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() : "";

          if (
            (strippedSku && (strippedSku === strippedCleaned || strippedCleaned.includes(strippedSku))) ||
            (strippedBc && (strippedBc === strippedCleaned || strippedCleaned.includes(strippedBc)))
          ) {
            const matchedPrice = resolvePrice(sv, customerType);
            return {
              success: true,
              matchType: "fuzzy",
              product,
              colorVariant: cv,
              subVariant: sv,
              exactSku: sv.sku,
              matchedPrice,
              availableStock: sv.stock,
              warehouseLocation: getWarehouseLocation(product.categoryId)
            };
          }
        }
      }
    }
  }

  return {
    success: false,
    matchType: "none",
    error: `Barcode/SKU "${rawInput}" not found in system inventory.`
  };
}

export function getWarehouseLocation(catId: string): string {
  const sections: Record<string, string> = {
    cat_kitchen_tools: "Aisle A, Rack 04 (Kitchen Goods)",
    cat_home_cleaning: "Aisle A, Rack 12 (Cleaning Supplies)",
    cat_electronics: "Aisle B, Rack 02 (Electronics)",
    cat_beauty: "Aisle C, Rack 08 (Cosmetics)",
    cat_fashion: "Aisle D, Rack 15 (Apparel)",
    cat_hardware: "Aisle E, Rack 03 (Tools & DIY)",
    cat_toys: "Aisle F, Rack 09 (Kids Section)"
  };
  return sections[catId] || "Aisle G, Rack 01 (General Storage)";
}
