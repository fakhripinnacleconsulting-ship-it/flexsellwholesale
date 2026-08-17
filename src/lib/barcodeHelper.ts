import JsBarcode from "jsbarcode";
import { SubVariant } from "@/types";

export interface BarcodeHelperOptions {
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
}

/**
 * Generates an SVG string representation of a Code 128 barcode using JsBarcode.
 * Defaults displayValue to false to avoid duplicate text rendering under barcode bars.
 */
export function getBarcodeSvgString(
  rawVal: string,
  widthOrOptions?: number | BarcodeHelperOptions,
  heightParam?: number
): string {
  const val = (rawVal || "").trim().toUpperCase();
  if (!val) return "<div style='color:red; font-size:10px;'>Invalid Barcode</div>";

  let options: BarcodeHelperOptions = {};
  if (typeof widthOrOptions === "number") {
    options = {
      width: widthOrOptions,
      height: heightParam ?? 35,
      displayValue: false
    };
  } else if (widthOrOptions) {
    options = widthOrOptions;
  }

  const width = options.width ?? 1.4;
  const height = options.height ?? 35;
  const displayValue = options.displayValue ?? false;
  const fontSize = options.fontSize ?? 11;
  const margin = options.margin ?? 2;
  const background = options.background ?? "#ffffff";
  const lineColor = options.lineColor ?? "#000000";

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      JsBarcode(svg, val, {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize,
        margin,
        font: "monospace",
        background,
        lineColor,
        valid: () => true
      });
      return svg.outerHTML;
    } catch (e) {
      console.warn("JsBarcode string generation notice:", e);
    }
  }

  // Pure SVG fallback if document is undefined
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="${height + 10}" viewBox="0 0 160 ${height + 10}" style="display:block; margin:0 auto; background:${background};">
    <rect width="100%" height="100%" fill="${background}" />
    <text x="50%" y="50%" text-anchor="middle" font-family="monospace" font-size="12" font-weight="bold" fill="${lineColor}">${val}</text>
  </svg>`;
}

export function generateBarcodeCardHtml(sv: SubVariant, colorName?: string): string {
  const barValue = sv.barcode || sv.sku || "FX0000";

  const barcodeContentHtml = (sv.barcodeSource === "image" && sv.barcodeImage)
    ? `<img src="${sv.barcodeImage}" style="max-height: 48px; max-width: 100%; object-fit: contain;" />`
    : getBarcodeSvgString(barValue, { width: 1.6, height: 48, displayValue: false, margin: 0 });

  const sizeText = colorName ? `${sv.size} / ${colorName}` : sv.size;

  return `
    <div class="barcode-card" style="width: 3in; height: 2in; border: 1px solid #999; border-radius: 8px; box-sizing: border-box; padding: 0.1in; margin: 4px; background: #fff; font-family: system-ui, -apple-system, sans-serif; overflow: hidden; page-break-inside: avoid; color: #000; display: flex; flex-direction: column; justify-content: space-between;">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 2px; height: 18px;">
        <img src="/Flexsell%20Logo.png" alt="FlexSell" style="height: 16px; object-fit: contain;" />
        <div style="display: flex; align-items: center; gap: 4px; font-size: 9px; font-weight: 500; color: #333;">
          <span>www.flexsellwholesale.com</span>
        </div>
      </div>

      <!-- Divider -->
      <div style="border-bottom: 1px solid #ccc; margin: 4px 0 6px 0;"></div>

      <!-- Barcode Section -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 4px;">
        <div style="width: 100%; text-align: center; display: flex; justify-content: center; height: 48px; overflow: hidden;">
          ${barcodeContentHtml}
        </div>
        <div style="font-size: 13px; font-weight: 800; font-family: monospace; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">
          ${sv.sku}
        </div>
      </div>

      <!-- Data Rows -->
      <div style="display: flex; flex-direction: column; gap: 4px; font-size: 10px; line-height: 1.2; padding: 0 4px; flex: 1; justify-content: center;">
        
        <!-- Row 1: Size and Weight -->
        <div style="display: flex; justify-content: space-between;">
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 60%;"><strong>Size:</strong> ${sizeText}</span>
          <span><strong>Weight:</strong> ${sv.weight || '-'}</span>
        </div>
        
        <!-- Row 2: MRP and B2C -->
        <div style="display: flex; justify-content: space-between;">
          <span><strong>MRP:</strong> Rs. ${sv.mrp}</span>
          <span><strong>B2C:</strong> Rs. ${sv.b2cPrice || 0}</span>
        </div>

      </div>

      <!-- Pricing Row -->
      <div style="border-top: 1px dashed #999; padding: 4px 4px 0 4px; margin-top: 2px;">
        <div style="font-size: 8px; font-weight: 700; color: #555; text-align: center; margin-bottom: 2px; letter-spacing: 1px;">FLEXSELL RATES</div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; font-weight: 800;">
          <span>DROP: <span style="font-size: 12px;">Rs. ${sv.dropshippingPrice || 0}</span></span>
          <span>B2B: <span style="font-size: 12px;">Rs. ${sv.b2bPrice || 0}</span></span>
          <span>B2B MOQ: <span style="font-size: 12px;">${sv.b2bMoq || 1}</span></span>
        </div>
      </div>

    </div>
  `;
}
