import JsBarcode from "jsbarcode";

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
