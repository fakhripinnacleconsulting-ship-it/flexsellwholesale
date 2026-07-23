"use client";

import * as React from "react";
import { CODE39_MAP } from "@/lib/barcodeHelper";

interface BarcodeProps {
  value?: string;
  sku?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function Barcode({ value = "", sku, className = "", width = 0.8, height = 20 }: BarcodeProps) {
  const encodeValue = React.useMemo(() => {
    return sku || value || "";
  }, [value, sku]);

  // Normalize value to uppercase and strip invalid characters
  const rawText = React.useMemo(() => {
    return encodeValue
      .toUpperCase()
      .split("")
      .filter(char => char in CODE39_MAP)
      .join("");
  }, [encodeValue]);

  // Wrap with Code 39 start/stop character '*'
  const encodedText = React.useMemo(() => {
    if (!rawText) return "";
    return `*${rawText}*`;
  }, [rawText]);

  // Construct binary representation
  const binaryBars = React.useMemo(() => {
    let result = "";
    for (let i = 0; i < encodedText.length; i++) {
      const char = encodedText[i];
      result += CODE39_MAP[char] + "0"; // 0 separator between characters
    }
    return result;
  }, [encodedText]);

  if (!binaryBars) {
    return <div className="text-[10px] text-destructive font-mono">Invalid Barcode</div>;
  }

  const svgWidth = binaryBars.length * width;

  return (
    <div className={`flex flex-col items-center p-1 bg-white rounded border border-gray-100 w-max select-none ${className}`}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full"
      >
        {binaryBars.split("").map((bit, idx) => {
          if (bit === "1") {
            return (
              <rect
                key={idx}
                x={idx * width}
                y={0}
                width={width}
                height={height}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
      <span className="text-[8px] font-mono font-bold tracking-widest text-black mt-1 uppercase">
        {sku || value}
      </span>
    </div>
  );
}
