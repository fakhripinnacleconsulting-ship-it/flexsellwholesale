import ExcelJS from "exceljs";
import { Product, Category, HsnRecord } from "@/types";
import { htmlToPlainText } from "./htmlConverter";
import { HEADERS, GUIDELINES, COL_WIDTHS } from "./excelTypes";

function buildInstructionsSheet(workbook: ExcelJS.Workbook) {
  const ws = workbook.addWorksheet("Instructions", {
    properties: { tabColor: { argb: "FF4472C4" } },
  });

  // Title
  ws.mergeCells("A1:D1");
  const titleCell = ws.getCell("A1");
  titleCell.value = "Guidelines for Bulk Product Upload / Update";
  titleCell.font = { bold: true, size: 16, color: { argb: "FF1F4E79" } };
  titleCell.alignment = { vertical: "middle" };
  ws.getRow(1).height = 32;

  // Intro
  ws.mergeCells("A3:D3");
  ws.getCell("A3").value = "This workbook lets you add new products or update existing ones in bulk.";
  ws.getCell("A3").font = { size: 11 };

  ws.mergeCells("A4:D4");
  ws.getCell("A4").value =
    "Fill in the 'Products' sheet. Each row = one variant combination. Rows with the same Product Name are grouped into one product.";
  ws.getCell("A4").font = { size: 11 };

  // Section header
  ws.mergeCells("A6:D6");
  const sectionCell = ws.getCell("A6");
  sectionCell.value = "Column Reference";
  sectionCell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
  sectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4472C4" } };
  ws.getRow(6).height = 26;

  // Table headers
  const tableHeaderRow = ws.getRow(7);
  tableHeaderRow.values = ["Column", "Field Name", "Required / Optional", "Description & Examples"];
  tableHeaderRow.font = { bold: true, size: 10 };
  tableHeaderRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF4472C4" } },
    };
  });

  // Column documentation rows (30 columns: A through AD)
  const colLetters = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z AA AB AC AD".split(" ");
  const requiredCols = new Set([0, 1, 2, 3, 4, 6, 7, 11, 12, 14, 23]); // indices

  const descriptions = [
    "Unique SKU code for this specific variant combination. Required for each row. Max 40 chars.",
    "Grouping key. Rows sharing the same Product Name become one product with multiple variants.",
    "Product description. Enter normal plain text. Use single newlines for breaks, and double newlines for paragraph spacing.",
    "Select from the dropdown list. Must match a category configured in your system.",
    "Select from the dropdown list. Shows HSN code with GST tax rate for reference.",
    "Whether the Selling Price includes GST. Defaults to TRUE if left blank.",
    "Maximum Retail Price. Must be ≥ B2C Price.",
    "Wholesale/B2C selling price. Must be a positive number.",
    "Optional B2B Trade Price. Defaults to B2C Price if left blank.",
    "Minimum order quantity for B2B. Defaults to 1 if left blank.",
    "Optional Dropshipping Price. Defaults to B2C Price if left blank.",
    "Current stock / inventory count. Integer ≥ 0.",
    "Variation type/color name. Use 'Default' for single-style products. Rows with same Product Name + Variation Type share images.",
    "Physical package dimensions of this variant. e.g. 15x12x8 cm. Used for volumetric shipping calculation.",
    "Primary image URL (required). JPG/PNG/WebP. At least 1 image per variation type.",
    "Additional image URL 2.", "Additional image URL 3.", "Additional image URL 4.",
    "Additional image URL 5.", "Additional image URL 6.", "Additional image URL 7.",
    "Additional image URL 8.", "Additional image URL 9.",
    "Size label. e.g. Standard, S, M, L, XL, 500g.",
    "Weight specification label. e.g. 250g, 1kg, 500ml.",
    "Optional numeric weight in grams (e.g. 250, 1000) for shipping calculation.",
    "Comma-separated product tags. e.g. eco-friendly, kitchen",
    "Comma-separated card badge tags. e.g. Hot, New, Bestseller",
    "Optional extra packaging fee in ₹. Default: 0.",
    "Optional. Select from dropdown: per_unit or per_order. Default: per_unit.",
  ];

  for (let i = 0; i < HEADERS.length; i++) {
    const row = ws.getRow(8 + i);
    row.values = [
      `Column ${colLetters[i]}`,
      HEADERS[i],
      requiredCols.has(i) ? "Required" : "Optional",
      descriptions[i] || "",
    ];
    row.getCell(3).font = {
      bold: requiredCols.has(i),
      color: { argb: requiredCols.has(i) ? "FFC00000" : "FF548235" },
    };
    row.alignment = { wrapText: true, vertical: "top" };
  }

  // Column widths
  ws.getColumn(1).width = 12;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 18;
  ws.getColumn(4).width = 80;

  // Protect Instructions sheet (read-only)
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  return ws;
}

export async function exportToExcel(
  products: Product[],
  categories: Category[],
  hsns: HsnRecord[],
  onlyTemplate: boolean = false
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FlexSell Wholesale";
  workbook.created = new Date();

  // Sheet 1: Instructions
  buildInstructionsSheet(workbook);

  // Sheet 2: Products
  const ws = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 2 }], // Freeze header + guidelines
  });

  // ── Row 1: Headers ────────────────────────────────────────────────────
  const headerRow = ws.getRow(1);
  headerRow.values = HEADERS;
  headerRow.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF2F5496" } },
      right: { style: "thin", color: { argb: "FF2F5496" } },
    };
    cell.protection = { locked: true };
  });

  // ── Row 2: Guidelines ─────────────────────────────────────────────────
  const guideRow = ws.getRow(2);
  guideRow.values = GUIDELINES;
  guideRow.font = { italic: true, size: 8, color: { argb: "FF808080" } };
  guideRow.alignment = { wrapText: true, vertical: "top" };
  guideRow.height = 32;
  guideRow.eachCell((cell) => {
    cell.protection = { locked: true };
  });

  // ── Column Widths ─────────────────────────────────────────────────────
  HEADERS.forEach((_, idx) => {
    ws.getColumn(idx + 1).width = COL_WIDTHS[idx] || 14;
  });

  // Unlock data cells in rows 3 to 2000 for user input
  for (let r = 3; r <= 2000; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= HEADERS.length; c++) {
      row.getCell(c).protection = { locked: false };
    }
  }

  // ── In-Cell Dropdown Validations (rows 3 to 2000) ─────────────────────
  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  const hsnOptions = hsns
    .map((h) => `${h.code} (${h.gstRate}%)`)
    .filter(Boolean);

  // Category dropdown (Column D)
  if (categoryNames.length > 0) {
    const catFormula = `"${categoryNames.join(",")}"`;
    (ws as any).dataValidations.add("D3:D2000", {
      type: "list",
      allowBlank: false,
      formulae: [catFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: "Please select a valid category from the dropdown list.",
    });
  }

  // HSN Code dropdown (Column E) — format: "3924 (18%),6912 (5%)"
  if (hsnOptions.length > 0) {
    const hsnFormula = `"${hsnOptions.join(",")}"`;
    (ws as any).dataValidations.add("E3:E2000", {
      type: "list",
      allowBlank: false,
      formulae: [hsnFormula],
      showErrorMessage: true,
      errorTitle: "Invalid HSN Code",
      error: "Please select a valid HSN code from the dropdown list.",
    });
  }

  // Price Includes GST dropdown (Column F)
  (ws as any).dataValidations.add("F3:F2000", {
    type: "list",
    allowBlank: true,
    formulae: ['"TRUE,FALSE"'],
  });

  // Packaging Charge Type dropdown (Column AD)
  (ws as any).dataValidations.add("AD3:AD2000", {
    type: "list",
    allowBlank: true,
    formulae: ['"per_unit,per_order"'],
  });

  // ── Populate Data Rows (for update export) ────────────────────────────
  if (!onlyTemplate && products.length > 0) {
    let rowIdx = 3;

    products.forEach((p) => {
      const category = categories.find((c) => c._id === p.categoryId);
      const categoryText = category ? category.name : "";
      const hsnRec = hsns.find((h) => h.code === p.hsnCode);
      const hsnText = p.hsnCode
        ? hsnRec
          ? `${p.hsnCode} (${hsnRec.gstRate}%)`
          : p.hsnCode
        : "";

      (p.colorVariants || []).forEach((cv) => {
        const imageUrls: string[] = (cv.images || [])
          .map((img) => (typeof img === "string" ? img : img.url || ""))
          .filter(Boolean);

        (cv.subVariants || []).forEach((sv) => {
          const row = ws.getRow(rowIdx);
          const values: any[] = [
            sv.sku || "",                                           // Col A: SKU (0)
            p.title || "",                                          // Col B: Product Name (1)
            htmlToPlainText(p.description || ""),                   // Col C: Description (2)
            categoryText,                                           // Col D: Category (3)
            hsnText,                                                // Col E: HSN Code (Tax %) (4)
            p.priceIncludesGst !== undefined ? (p.priceIncludesGst ? "TRUE" : "FALSE") : "TRUE", // Col F: Price Includes GST (5)
            sv.mrp !== undefined ? sv.mrp : "",                     // Col G: MRP (6)
            sv.b2cPrice !== undefined ? sv.b2cPrice : "",           // Col H: B2C Price (7)
            sv.b2bPrice !== undefined ? sv.b2bPrice : "",           // Col I: B2B Price (8)
            sv.b2bMoq !== undefined ? sv.b2bMoq : 1,                // Col J: MOQ (9)
            sv.dropshippingPrice !== undefined ? sv.dropshippingPrice : "", // Col K: Dropshipping Price (10)
            sv.stock !== undefined ? sv.stock : 0,                  // Col L: Stock (11)
            cv.color || "Default",                                  // Col M: Variation Type (12)
            cv.dimensions || "",                                    // Col N: Dimensions (13)
          ];

          // Image URL columns (Col O-W, 9 individual columns)
          for (let i = 0; i < 9; i++) {
            values.push(imageUrls[i] || "");
          }

          values.push(
            sv.size || "",                                          // Col X: Size (23)
            sv.weight || "",                                        // Col Y: Weight (24)
            sv.weightGrams !== undefined && sv.weightGrams !== null ? sv.weightGrams : "", // Col Z: Weight (grams) (25)
            (p.tags || []).join(", "),                              // Col AA: Tags (26)
            (p.cardTags || []).join(", "),                          // Col AB: Card Tags (27)
            p.packagingCharge !== undefined ? p.packagingCharge : 0,// Col AC: Packaging Charge (28)
            p.packagingChargeType || "per_unit"                     // Col AD: Packaging Charge Type (29)
          );

          row.values = values;
          row.alignment = { wrapText: true, vertical: "top" };
          rowIdx++;
        });
      });
    });
  }

  // ── Native Excel Conditional Formatting Rules (Rows 3 to 2000) ───────────────
  // 1. SKU (Col A): Red fill ONLY IF row has Product Name AND (SKU is blank OR duplicate in sheet)
  ws.addConditionalFormatting({
    ref: "A3:A2000",
    rules: [
      {
        type: "expression",
        priority: 1,
        formulae: ['AND(NOT(ISBLANK($B3)), OR(ISBLANK(A3), COUNTIF($A$3:$A$2000, A3)>1))'],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" }, bold: true },
        },
      },
    ],
  });

  // 2. Variation Type (Col M): Red fill ONLY IF row has Product Name AND Variation Type is blank
  ws.addConditionalFormatting({
    ref: "M3:M2000",
    rules: [
      {
        type: "expression",
        priority: 2,
        formulae: ['AND(NOT(ISBLANK($B3)), ISBLANK(M3))'],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" }, bold: true },
        },
      },
    ],
  });

  // 3. Size (Col X): Red fill ONLY IF row has Product Name AND Size is blank
  ws.addConditionalFormatting({
    ref: "X3:X2000",
    rules: [
      {
        type: "expression",
        priority: 3,
        formulae: ['AND(NOT(ISBLANK($B3)), ISBLANK(X3))'],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" }, bold: true },
        },
      },
    ],
  });

  // 4. MRP & B2C Price (Col G & H): Red fill ONLY IF row has Product Name AND (MRP or Price is blank or 0)
  ws.addConditionalFormatting({
    ref: "G3:H2000",
    rules: [
      {
        type: "expression",
        priority: 4,
        formulae: ['AND(NOT(ISBLANK($B3)), OR(ISBLANK(G3), G3=0))'],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" } },
        },
      },
    ],
  });

  // 5. Stock (Col L): Red fill ONLY IF row has Product Name AND Stock is blank
  ws.addConditionalFormatting({
    ref: "L3:L2000",
    rules: [
      {
        type: "expression",
        priority: 5,
        formulae: ['AND(NOT(ISBLANK($B3)), ISBLANK(L3))'],
        style: {
          fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } },
          font: { color: { argb: "FF9C0006" } },
        },
      },
    ],
  });

  // Protect Products sheet so header/guidelines are locked, data cells editable
  ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
  });

  // ── Generate blob ─────────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ─── Download Helper ─────────────────────────────────────────────────────
export async function downloadExcel(
  products: Product[],
  categories: Category[],
  hsns: HsnRecord[],
  onlyTemplate: boolean = false
) {
  const blob = await exportToExcel(products, categories, hsns, onlyTemplate);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const timestamp = `${year}${month}${day}_${hours}${minutes}`;

  a.download = onlyTemplate
    ? `flexsell_add_products_${timestamp}.xlsx`
    : `flexsell_update_products_${timestamp}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
