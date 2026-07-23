export interface ExcelValidationError {
  row: number;
  column: string;
  message: string;
  type: "error" | "warning";
  productId?: string;
  sku?: string;
}

export const HEADERS = [
  "Product Name",           // A (0)
  "Description",            // B (1)
  "Category",               // C (2)  — dropdown
  "HSN Code",               // D (3)  — dropdown
  "Price Includes GST",     // E (4)  — dropdown TRUE/FALSE
  "Min Order Qty (MOQ)",    // F (5)
  "Tags",                   // G (6)
  "Card Tags",              // H (7)
  "SEO Title",              // I (8)
  "SEO Description",        // J (9)
  "SEO Keywords",           // K (10)
  "Color",                  // L (11)
  "Dimensions",             // M (12)
  "Image URL 1",            // N (13)
  "Image URL 2",            // O (14)
  "Image URL 3",            // P (15)
  "Image URL 4",            // Q (16)
  "Image URL 5",            // R (17)
  "Image URL 6",            // S (18)
  "Image URL 7",            // T (19)
  "Image URL 8",            // U (20)
  "Image URL 9",            // V (21)
  "Size",                   // W (22)
  "Weight",                 // X (23)
  "B2C Price",              // Y (24)
  "MRP",                    // Z (25)
  "Stock",                  // AA (26)
  "SKU",                    // AB (27)
  "B2B Price",              // AC (28)
  "Dropshipping Price",     // AD (29)
];

export const GUIDELINES = [
  "Required. Max 200 chars. Rows with same name are grouped into one product.",
  "Required. Max 5000 chars. Enter normal plain text (emojis, lists, etc. are supported). Use single newlines for breaks, double newlines for paragraphs.",
  "Required. Select from dropdown.",
  "Required. Select from dropdown.",
  "Optional. Default: TRUE.",
  "Optional B2B Minimum Order Quantity. Defaults to 1 if left blank. Integer >= 1.",
  "Optional. Comma-separated. e.g. premium, kitchen.",
  "Optional. Comma-separated. e.g. Hot, New, Bestseller.",
  "Optional. Max 60 chars. Auto-generated if blank.",
  "Optional. Max 160 chars. Auto-generated if blank.",
  "Optional. Comma-separated. Auto-generated if blank.",
  "Required. e.g. Red, Blue. Use 'Default' for single-color products.",
  "Optional. e.g. 15x12x8 cm.",
  "Required. Min 1 image URL per color variant.",
  "Optional.", "Optional.", "Optional.", "Optional.",
  "Optional.", "Optional.", "Optional.", "Optional.",
  "Required. e.g. Standard, L, XL, 500g.",
  "Optional. e.g. 250g, 1kg.",
  "Required. B2C Selling Price. Number > 0.",
  "Required. Maximum Retail Price. Must be >= B2C Price.",
  "Required. Integer >= 0. Inventory count.",
  "Required. Max 40 chars. Must be unique across all variants.",
  "Optional. B2B Trade Price. Number > 0.",
  "Optional. Dropshipping Price. Number > 0.",
];

export const COL_WIDTHS = [
  28, // Product Name
  45, // Description
  20, // Category
  14, // HSN Code
  18, // Price Includes GST
  18, // MOQ
  22, // Tags
  20, // Card Tags
  22, // SEO Title
  28, // SEO Description
  22, // SEO Keywords
  14, // Color
  16, // Dimensions
  32, // Image URL 1
  32, 32, 32, 32, 32, 32, 32, 32, // Image URLs 2–9
  14, // Size
  12, // Weight
  14, // B2C Price
  12, // MRP
  10, // Stock
  18, // SKU
  14, // B2B Price
  16, // Dropshipping Price
];
