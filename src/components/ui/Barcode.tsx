"use client";

import * as React from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value?: string;
  sku?: string;
  className?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}

export function Barcode({
  value = "",
  sku,
  className = "",
  width = 1.5,
  height = 35,
  displayValue = false,
  fontSize = 11
}: BarcodeProps) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const encodeValue = React.useMemo(() => {
    return (sku || value || "").trim().toUpperCase();
  }, [value, sku]);

  const [hasError, setHasError] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!encodeValue || !svgRef.current) {
      setHasError(!encodeValue);
      return;
    }

    try {
      JsBarcode(svgRef.current, encodeValue, {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize,
        fontOptions: "bold",
        margin: 2,
        font: "monospace",
        background: "transparent",
        lineColor: "#000000",
        valid: (valid) => {
          setHasError(!valid);
        }
      });
      setHasError(false);
    } catch (err) {
      console.warn("JsBarcode render notice:", err);
      setHasError(true);
    }
  }, [encodeValue, width, height, displayValue, fontSize]);

  if (!encodeValue || hasError) {
    return (
      <div className={`flex flex-col items-center justify-center p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-mono ${className}`}>
        Invalid Barcode ({encodeValue || "Empty"})
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center p-1.5 bg-white rounded border border-gray-200 select-none ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto block" />
      <span className="text-[11px] font-mono font-extrabold text-black mt-1 tracking-wider">{encodeValue}</span>
    </div>
  );
}
