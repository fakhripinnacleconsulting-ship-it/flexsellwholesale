export interface ExcelValidationError {
  row: number;
  column: string;
  message: string;
  type: "error" | "warning";
  productId?: string;
  sku?: string;
}

export const HEADERS = [
  "SKU",                     // A (0)
  "Product Name",            // B (1)
  "Description",             // C (2)
  "Category",                // D (3) — dropdown
  "HSN Code (Tax %)",        // E (4) — dropdown with tax %
  "Price Includes GST",      // F (5) — dropdown TRUE/FALSE
  "MRP",                     // G (6)
  "B2C Price",               // H (7)
  "B2B Price",               // I (8)
  "Min Order Qty (MOQ)",     // J (9)
  "Dropshipping Price",      // K (10)
  "Stock",                   // L (11)
  "Variation Type",          // M (12)
  "Dimensions",              // N (13)
  "Image URL 1",             // O (14)
  "Image URL 2",             // P (15)
  "Image URL 3",             // Q (16)
  "Image URL 4",             // R (17)
  "Image URL 5",             // S (18)
  "Image URL 6",             // T (19)
  "Image URL 7",             // U (20)
  "Image URL 8",             // V (21)
  "Image URL 9",             // W (22)
  "Size",                    // X (23)
  "Weight",                  // Y (24)
  "Weight (grams)",          // Z (25)
  "Tags",                    // AA (26)
  "Card Tags",               // AB (27)
  "Handling Charge",        // AC (28)
  "Handling Charge Type",   // AD (29) — dropdown per_unit/per_order
];

export const GUIDELINES = [
  "Required. Max 40 chars. Must be unique across all variants.", // SKU
  "Required. Max 200 chars. Rows with same name are grouped into one product.", // Product Name
  "Required. Max 5000 chars. Enter normal plain text. Use single newlines for breaks, double newlines for paragraphs.", // Description
  "Required. Select from dropdown.", // Category
  "Required. Select from dropdown. Shows HSN code with GST tax rate for reference.", // HSN Code (Tax %)
  "Optional. Select TRUE/FALSE. Defaults to TRUE if left blank.", // Price Includes GST
  "Required. Maximum Retail Price. Must be >= B2C Price.", // MRP
  "Required. B2C Selling Price. Number > 0.", // B2C Price
  "Optional. B2B Trade Price. Number > 0. Defaults to B2C Price if left blank.", // B2B Price
  "Optional B2B Minimum Order Quantity. Defaults to 1 if left blank. Integer >= 1.", // MOQ
  "Optional. Dropshipping Price. Number > 0. Defaults to B2C Price if left blank.", // Dropshipping Price
  "Required. Integer >= 0. Inventory count.", // Stock
  "Required. e.g. Red, Standard, Wooden. Use 'Default' for single-color/single-style products.", // Variation Type
  "Optional. e.g. 15x12x8 cm. Used for volumetric shipping calculation.", // Dimensions
  "Required. Min 1 image URL per variation type.", // Image URL 1
  "Optional.", "Optional.", "Optional.", "Optional.", "Optional.", "Optional.", "Optional.", "Optional.", // Image URLs 2-9
  "Required. e.g. Standard, S, M, L, XL, 500g.", // Size
  "Optional. Text label e.g. 250g, 1kg, 500ml.", // Weight
  "Optional. Numeric weight in grams (e.g. 250, 1000) for shipping calculation.", // Weight (grams)
  "Optional. Comma-separated. e.g. eco-friendly, kitchen.", // Tags
  "Optional. Comma-separated. e.g. Hot, New, Bestseller.", // Card Tags
  "Optional. Extra packaging fee in ₹ (e.g. 10, 25). Default: 0.", // Handling Charge
  "Optional. Select from dropdown: per_unit or per_order. Default: per_unit.", // Handling Charge Type
];

export const COL_WIDTHS = [
  18, // SKU
  28, // Product Name
  45, // Description
  20, // Category
  18, // HSN Code (Tax %)
  18, // Price Includes GST
  12, // MRP
  14, // B2C Price
  14, // B2B Price
  18, // MOQ
  16, // Dropshipping Price
  10, // Stock
  16, // Variation Type
  16, // Dimensions
  32, // Image URL 1
  32, 32, 32, 32, 32, 32, 32, 32, // Image URLs 2-9
  14, // Size
  12, // Weight
  16, // Weight (grams)
  22, // Tags
  20, // Card Tags
  18, // Handling Charge
  22, // Handling Charge Type
];

