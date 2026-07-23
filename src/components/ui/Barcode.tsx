"use client";

import * as React from "react";

// Code 39 Encoding Table
// 1 = Black Bar (narrow or wide), 0 = White space (narrow or wide)
const CODE39_MAP: Record<string, string> = {
  "0": "101001101101",
  "1": "110100101011",
  "2": "101100101011",
  "3": "110110010101",
  "4": "101001101011",
  "5": "110100110101",
  "6": "101100110101",
  "7": "101001011011",
  "8": "110100101101",
  "9": "101100101101",
  "A": "110101001011",
  "B": "101101001011",
  "C": "110110100101",
  "D": "101011001011",
  "E": "110101100101",
  "F": "101101100101",
  "G": "101010011011",
  "H": "110101001101",
  "I": "101101001101",
  "J": "101011001101",
  "K": "110101010011",
  "L": "101101010011",
  "M": "110110101001",
  "N": "101011010011",
  "O": "110101101001",
  "P": "101101101001",
  "Q": "101010110011",
  "R": "110101011001",
  "S": "101101011001",
  "T": "101011011001",
  "U": "110010101011",
  "V": "100110101011",
  "W": "110011010101",
  "X": "100101101011",
  "Y": "110010110101",
  "Z": "100110110101",
  "-": "100101011011",
  ".": "110010101101",
  " ": "100110101101",
  "*": "100101101101", // Start/Stop
  "$": "100100100101",
  "/": "100100101001",
  "+": "100101001001",
  "%": "100100100101"
};

interface BarcodeProps {
  value?: string;
  sku?: string;
  className?: string;
  width?: number;
  height?: number;
}

export function Barcode({ value = "", sku, className = "", width = 0.8, height = 20 }: BarcodeProps) {
  const encodeValue = React.useMemo(() => {
    let raw = sku || value || "";
    // If it's a long SKU (longer than 8 characters), slice it down to compress space
    if (raw.length > 8 && !raw.startsWith("FX")) {
      raw = raw.slice(-6); // Take last 6 characters for a smaller footprint
    }
    return raw;
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
