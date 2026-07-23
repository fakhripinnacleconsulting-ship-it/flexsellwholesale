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

  // Column documentation rows
  const colLetters = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z AA AB".split(" ");
  const requiredCols = new Set([0, 1, 2, 3, 11, 13, 22, 24, 25, 26, 27]); // indices

  const descriptions = [
    "Grouping key. Rows sharing the same Product Name become one product with multiple variants.",
    "Product description. Enter normal plain text (emojis, lists, etc. are supported). Use single newlines for breaks, and double newlines for paragraph spacing. This will be automatically converted to rich text formatting in the application.",
    "Select from the dropdown list. Must match a category configured in your system.",
    "Select from the dropdown list. GST rate is auto-determined from this code.",
    "Whether the Selling Price includes GST. Defaults to TRUE if left blank.",
    "Minimum order quantity. Defaults to 1 if left blank.",
    "Comma-separated product tags. e.g. premium, eco-friendly, kitchen",
    "Comma-separated card badge tags. e.g. Hot, New, Bestseller",
    "Page title for SEO. Auto-generated from Product Name if blank.",
    "Meta description for SEO. Auto-generated if blank.",
    "Comma-separated SEO keywords. Auto-generated if blank.",
    "Color name for this variant group. Use 'Default' for single-color products. Rows with the same Product Name + Color share images.",
    "Physical dimensions of this variant. e.g. 15x12x8 cm",
    "Primary image URL (required). JPG/PNG/WebP. At least 1 image per color variant.",
    "Additional image URL 2.", "Additional image URL 3.", "Additional image URL 4.",
    "Additional image URL 5.", "Additional image URL 6.", "Additional image URL 7.",
    "Additional image URL 8.", "Additional image URL 9.",
    "Size label. e.g. Standard, S, M, L, XL, 500g",
    "Weight specification. e.g. 250g, 1kg, 500ml",
    "Wholesale selling price. Must be a positive number.",
    "Maximum Retail Price. Must be ≥ Selling Price.",
    "Current stock / inventory count. Integer ≥ 0.",
    "Unique SKU code for this specific variant combination. Max 40 chars.",
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
  headerRow.eachCell((cell, colNumber) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4472C4" },
    };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF2F5496" } },
      right: { style: "thin", color: { argb: "FF2F5496" } },
    };
  });

  // ── Row 2: Guidelines ─────────────────────────────────────────────────
  const guideRow = ws.getRow(2);
  guideRow.values = GUIDELINES;
  guideRow.font = { italic: true, size: 8, color: { argb: "FF808080" } };
  guideRow.alignment = { wrapText: true, vertical: "top" };
  guideRow.height = 32;

  // ── Column Widths ─────────────────────────────────────────────────────
  HEADERS.forEach((_, idx) => {
    ws.getColumn(idx + 1).width = COL_WIDTHS[idx] || 14;
  });

  // ── In-Cell Dropdown Validations (rows 3 to 2000) ─────────────────────
  const categoryNames = categories.map((c) => c.name).filter(Boolean);
  const hsnCodes = hsns.map((h) => h.code).filter(Boolean);

  // Category dropdown (Column C)
  if (categoryNames.length > 0) {
    const catFormula = `"${categoryNames.join(",")}"`;
    (ws as any).dataValidations.add("C3:C2000", {
      type: "list",
      allowBlank: false,
      formulae: [catFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Category",
      error: "Please select a valid category from the dropdown list.",
    });
  }

  // HSN Code dropdown (Column D)
  if (hsnCodes.length > 0) {
    const hsnFormula = `"${hsnCodes.join(",")}"`;
    (ws as any).dataValidations.add("D3:D2000", {
      type: "list",
      allowBlank: false,
      formulae: [hsnFormula],
      showErrorMessage: true,
      errorTitle: "Invalid HSN Code",
      error: "Please select a valid HSN code from the dropdown list.",
    });
  }

  // Price Includes GST dropdown (Column E)
  (ws as any).dataValidations.add("E3:E2000", {
    type: "list",
    allowBlank: true,
    formulae: ['"TRUE,FALSE"'],
  });

  // ── Populate Data Rows (for update export) ────────────────────────────
  if (!onlyTemplate && products.length > 0) {
    let rowIdx = 3;

    products.forEach((p) => {
      const category = categories.find((c) => c._id === p.categoryId);
      const categoryText = category ? category.name : "";

      (p.colorVariants || []).forEach((cv) => {
        const imageUrls: string[] = (cv.images || []).map((img) =>
          typeof img === "string" ? img : img.url || ""
        ).filter(Boolean);

        (cv.subVariants || []).forEach((sv) => {
          const row = ws.getRow(rowIdx);
          const values: any[] = [
            p.title || "",
            htmlToPlainText(p.description || ""),                    // Convert rich HTML description to normal plain text with line breaks
            categoryText,
            p.hsnCode || "",
            p.priceIncludesGst !== undefined ? (p.priceIncludesGst ? "TRUE" : "FALSE") : "TRUE",
            sv.b2bMoq !== undefined ? sv.b2bMoq : 1,
            (p.tags || []).join(", "),
            (p.cardTags || []).join(", "),
            p.seoTitle || "",
            p.seoDescription || "",
            p.seoKeywords || "",
            cv.color || "Default",
            cv.dimensions || "",
          ];

          // Image URL columns (9 individual columns)
          for (let i = 0; i < 9; i++) {
            values.push(imageUrls[i] || "");
          }

          values.push(
            sv.size || "",
            sv.weight || "",
            sv.b2cPrice !== undefined ? sv.b2cPrice : "",
            sv.mrp !== undefined ? sv.mrp : "",
            sv.stock !== undefined ? sv.stock : 0,
            sv.sku || "",
            sv.b2bPrice !== undefined ? sv.b2bPrice : "",
            sv.dropshippingPrice !== undefined ? sv.dropshippingPrice : ""
          );

          row.values = values;
          row.alignment = { wrapText: true, vertical: "top" };
          rowIdx++;
        });
      });
    });
  }

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
