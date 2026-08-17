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

export function generateBarcodeCardHtml(sv: SubVariant): string {
  const barValue = sv.barcode || sv.sku || "FX0000";
  
  const barcodeContentHtml = (sv.barcodeSource === "image" && sv.barcodeImage)
    ? `<img src="${sv.barcodeImage}" style="max-height: 40px; max-width: 100%; object-fit: contain;" />`
    : getBarcodeSvgString(barValue, { width: 1.5, height: 40, displayValue: false });

  return `
    <div class="barcode-card" style="width: 3in; height: 2in; display: inline-flex; flex-direction: column; justify-content: center; align-items: center; border: 1px dashed #ccc; box-sizing: border-box; padding: 0.1in; margin: 4px; background: #fff; text-align: center;">
      <div style="display:flex; justify-content:center; width: 100%;">
        ${barcodeContentHtml}
      </div>
      <div style="font-size: 13px; font-weight: bold; font-family: monospace; text-transform: uppercase; margin-top: 4px; letter-spacing: 0.5px; text-align: center;">${sv.sku}</div>
      <div style="margin-top: 8px; font-size: 9px; font-family: sans-serif; width: 100%; display: flex; justify-content: space-around; flex-wrap: wrap; line-height: 1.4;">
        <span><strong>B2C:</strong> ₹${sv.b2cPrice || 0}</span>
        <span><strong>B2B:</strong> ₹${sv.b2bPrice || 0}</span>
        <span><strong>Drop:</strong> ₹${sv.dropshippingPrice || 0}</span>
        <span><strong>MOQ:</strong> ${sv.b2bMoq || 1}</span>
      </div>
    </div>
  `;
}
