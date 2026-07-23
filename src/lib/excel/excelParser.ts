import ExcelJS from "exceljs";
import { Product, Category, HsnRecord, ColorVariant } from "@/types";
import { plainTextToHtml } from "./htmlConverter";
import { ExcelValidationError } from "./excelTypes";

export async function parseAndValidateExcel(
  fileData: ArrayBuffer,
  categories: Category[],
  hsns: HsnRecord[],
  systemProducts: Product[] = []
): Promise<{
  products: Partial<Product>[];
  errors: ExcelValidationError[];
  stats: {
    productsCount: number;
    variantsCount: number;
    combinationsCount: number;
  };
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileData);

  // Find the data sheet (first sheet that isn't "Instructions")
  let ws: ExcelJS.Worksheet | undefined;
  for (const sheet of workbook.worksheets) {
    if (sheet.name.toLowerCase() !== "instructions") {
      ws = sheet;
      break;
    }
  }
  if (!ws) ws = workbook.worksheets[0];

  if (!ws || ws.rowCount === 0) {
    return {
      products: [],
      errors: [{ row: 1, column: "File", message: "The sheet is empty", type: "error" }],
      stats: { productsCount: 0, variantsCount: 0, combinationsCount: 0 },
    };
  }

  // Build lookup maps
  const categoryNameMap = new Map<string, string>();
  categories.forEach((c) => {
    categoryNameMap.set(c.name.toLowerCase().trim(), c._id);
    categoryNameMap.set(c._id.toLowerCase().trim(), c._id);
  });

  const hsnCodeMap = new Map<string, number>();
  hsns.forEach((h) => {
    hsnCodeMap.set(h.code.trim(), h.gstRate);
  });

  const systemSkuMap = new Map<string, Product>();
  systemProducts.forEach((p) => {
    p.colorVariants?.forEach((cv) => {
      cv.subVariants?.forEach((sv) => {
        if (sv.sku) systemSkuMap.set(sv.sku.toLowerCase().trim(), p);
      });
    });
  });

  const systemTitleMap = new Map<string, Product>();
  systemProducts.forEach((p) => {
    systemTitleMap.set(p.title.toLowerCase().trim(), p);
  });

  const errors: ExcelValidationError[] = [];
  const productGroups = new Map<
    string,
    {
      productFields: any;
      variants: Map<string, { dimensions: string; images: any[]; subVariants: any[] }>;
    }
  >();
  const skuCounts = new Map<string, number>();

  // Helpers
  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return "";
    if (typeof val === "object") {
      if (val.text !== undefined) return String(val.text).trim();
      if (val.result !== undefined) return String(val.result).trim();
      if (val.hyperlink !== undefined) return String(val.hyperlink).trim();
    }
    return String(val).trim();
  };
  const cleanBool = (val: any, defaultVal: boolean = true) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    let actualVal = val;
    if (typeof val === "object") {
      if (val.result !== undefined) actualVal = val.result;
      else if (val.text !== undefined) actualVal = val.text;
    }
    const s = String(actualVal).toLowerCase().trim();
    return s === "true" || s === "1" || s === "yes";
  };
  const cleanNum = (val: any, defaultVal: number = 0) => {
    if (val === undefined || val === null || val === "") return defaultVal;
    let actualVal = val;
    if (typeof val === "object") {
      if (val.result !== undefined) actualVal = val.result;
      else if (val.text !== undefined) actualVal = val.text;
    }
    const n = Number(actualVal);
    return isNaN(n) ? defaultVal : n;
  };

  // Determine data start row (skip header + guidelines)
  let startRow = 2; // Default: row 2 is data (1-indexed, row 1 is header)
  const row2 = ws.getRow(2);
  const row2Val = cleanStr(row2.getCell(1).value);
  if (
    row2Val.toLowerCase().includes("required") ||
    row2Val.toLowerCase().includes("optional") ||
    row2Val.toLowerCase().includes("max") ||
    row2Val.toLowerCase().includes("limit")
  ) {
    startRow = 3; // Skip guidelines row
  }

  // Parse data rows
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < startRow) return;

    const getCellVal = (colIdx: number) => {
      const cell = row.getCell(colIdx);
      return cell.value;
    };

    const title = cleanStr(getCellVal(1));
    const description = plainTextToHtml(cleanStr(getCellVal(2)));
    const categoryVal = cleanStr(getCellVal(3));
    const hsnCode = cleanStr(getCellVal(4));
    const priceIncludesGst = cleanBool(getCellVal(5), true);
    const b2bMoq = cleanNum(getCellVal(6), 1);
    const tags = cleanStr(getCellVal(7)).split(",").map((t) => t.trim()).filter(Boolean);
    const cardTags = cleanStr(getCellVal(8)).split(",").map((t) => t.trim()).filter(Boolean);
    const seoTitle = cleanStr(getCellVal(9));
    const seoDescription = cleanStr(getCellVal(10));
    const seoKeywords = cleanStr(getCellVal(11));

    const color = cleanStr(getCellVal(12)) || "Default";
    const dimensions = cleanStr(getCellVal(13));

    // Parse 9 individual image URL columns (columns 14–22)
    const imageUrls: string[] = [];
    for (let i = 14; i <= 22; i++) {
      const url = cleanStr(getCellVal(i));
      if (url) imageUrls.push(url);
    }

    const size = cleanStr(getCellVal(23)) || "Standard";
    const weight = cleanStr(getCellVal(24));
    const b2cPrice = cleanNum(getCellVal(25), -1);
    const mrp = cleanNum(getCellVal(26), -1);
    const stock = cleanNum(getCellVal(27), 0);
    const sku = cleanStr(getCellVal(28));
    const b2bPrice = cleanNum(getCellVal(29), 0);
    const dropshippingPrice = cleanNum(getCellVal(30), 0);

    // ── Validations ──────────────────────────────────────────────────
    if (!title) {
      errors.push({ row: rowNumber, column: "Product Name", message: "Product Name is required.", type: "error" });
      return;
    }

    if (!sku) {
      errors.push({ row: rowNumber, column: "SKU", message: "SKU is required for each variant row.", type: "error" });
      return;
    }

    // SKU uniqueness within sheet
    const skuKey = sku.toLowerCase().trim();
    skuCounts.set(skuKey, (skuCounts.get(skuKey) || 0) + 1);
    if ((skuCounts.get(skuKey) || 0) > 1) {
      errors.push({
        row: rowNumber,
        column: "SKU",
        message: `Duplicate SKU '${sku}' found in the uploaded sheet.`,
        type: "error",
        sku,
      });
    }

    // SKU conflict with database
    if (systemSkuMap.has(skuKey)) {
      const existingProduct = systemSkuMap.get(skuKey)!;
      if (title && existingProduct.title.toLowerCase().trim() !== title.toLowerCase().trim()) {
        errors.push({
          row: rowNumber,
          column: "SKU",
          message: `SKU '${sku}' is already registered to a different product: '${existingProduct.title}'.`,
          type: "error",
          sku,
          productId: existingProduct._id,
        });
      } else {
        errors.push({
          row: rowNumber,
          column: "SKU",
          message: `SKU '${sku}' already exists. Will update existing variant under '${existingProduct.title}'.`,
          type: "warning",
          sku,
          productId: existingProduct._id,
        });
      }
    }

    if (b2cPrice < 0) {
      errors.push({ row: rowNumber, column: "B2C Price", message: "B2C Price is required.", type: "error", sku });
    }
    if (mrp < 0) {
      errors.push({ row: rowNumber, column: "MRP", message: "MRP is required.", type: "error", sku });
    }
    if (b2cPrice > mrp && mrp >= 0) {
      errors.push({ row: rowNumber, column: "B2C Price / MRP", message: "B2C Price cannot exceed MRP.", type: "error", sku });
    }

    // Minimum 1 image validation
    if (imageUrls.length === 0) {
      errors.push({
        row: rowNumber,
        column: "Image URL 1",
        message: "At least 1 image URL is required per color variant.",
        type: "error",
        sku,
      });
    }

    // ── Grouping by Product Title ────────────────────────────────────
    const groupKey = title.toLowerCase().trim();

    if (!productGroups.has(groupKey)) {
      if (!description) {
        errors.push({ row: rowNumber, column: "Description", message: "Product Description is required.", type: "error" });
      }

      let categoryId = "";
      if (!categoryVal) {
        errors.push({ row: rowNumber, column: "Category", message: "Category is required.", type: "error" });
      } else {
        categoryId = categoryNameMap.get(categoryVal.toLowerCase().trim()) || "";
        if (!categoryId) {
          errors.push({
            row: rowNumber,
            column: "Category",
            message: `Category '${categoryVal}' not found in system.`,
            type: "warning",
          });
          categoryId = categories[0]?._id || "unknown";
        }
      }

      if (!hsnCode) {
        errors.push({ row: rowNumber, column: "HSN Code", message: "HSN Code is required.", type: "error" });
      } else if (!hsnCodeMap.has(hsnCode)) {
        errors.push({
          row: rowNumber,
          column: "HSN Code",
          message: `HSN Code '${hsnCode}' not recognized in system.`,
          type: "warning",
        });
      }

      // Check if product already exists in DB
      const existingProduct = systemTitleMap.get(groupKey);
      if (existingProduct) {
        errors.push({
          row: rowNumber,
          column: "Product Name",
          message: `Product '${existingProduct.title}' already exists. This sheet will update its fields and merge variants.`,
          type: "warning",
          productId: existingProduct._id,
        });
      }

      productGroups.set(groupKey, {
        productFields: {
          title,
          description,
          categoryId,
          hsnCode,
          priceIncludesGst,
          defaultPriceTier: "B2C",
          tags,
          cardTags,
          seoTitle,
          seoDescription,
          seoKeywords,
          isActive: true,
        },
        variants: new Map(),
      });
    }

    const productInfo = productGroups.get(groupKey)!;
    const colorKey = color.toLowerCase().trim();

    if (!productInfo.variants.has(colorKey)) {
      const parsedImages = imageUrls.map((url) => ({
        url,
        alt: `${productInfo.productFields.title} - ${color}`,
      }));

      productInfo.variants.set(colorKey, {
        dimensions,
        images: parsedImages,
        subVariants: [],
      });
    }

    const colorGroup = productInfo.variants.get(colorKey)!;
    colorGroup.subVariants.push({
      size,
      weight,
      b2cPrice,
      b2bPrice: b2bPrice > 0 ? b2bPrice : b2cPrice,
      dropshippingPrice: dropshippingPrice > 0 ? dropshippingPrice : b2cPrice,
      b2bMoq,
      mrp,
      stock,
      sku,
      isActive: true,
    });
  });

  // ── Assemble Products ─────────────────────────────────────────────────
  const assembledProducts: Partial<Product>[] = [];
  let totalVariants = 0;
  let totalCombinations = 0;

  productGroups.forEach((group) => {
    const { productFields, variants } = group;
    const colorVariants: ColorVariant[] = [];

    totalVariants += variants.size;

    variants.forEach((cvGroup, colorName) => {
      totalCombinations += cvGroup.subVariants.length;

      const colorLabel = colorName === "default" ? "Default" : colorName;

      colorVariants.push({
        color: colorLabel.charAt(0).toUpperCase() + colorLabel.slice(1),
        dimensions: cvGroup.dimensions,
        images: cvGroup.images,
        subVariants: cvGroup.subVariants.map((sv, svIdx) => ({
          ...sv,
          id: `sv-${Date.now()}-${svIdx}-${Math.random().toString(36).substr(2, 5)}`,
        })),
      });
    });

    assembledProducts.push({
      ...productFields,
      colorVariants,
    });
  });

  return {
    products: assembledProducts,
    errors,
    stats: {
      productsCount: assembledProducts.length,
      variantsCount: totalVariants,
      combinationsCount: totalCombinations,
    },
  };
}
