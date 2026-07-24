"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/components/ui/Barcode";
import { useProductForm } from "./ProductFormContext";
import { Upload, Download, Trash2, CheckCircle2, ShieldCheck, Printer } from "lucide-react";
import { getBarcodeSvgString } from "@/lib/barcodeHelper";
import { useToastStore } from "@/stores/toastStore";

export function BarcodeCard() {
  const { addToast } = useToastStore();
  const {
    title,
    variantsList,
    barcode,
    setBarcode,
    barcodeSource,
    setBarcodeSource,
    barcodeImage,
    setBarcodeImage,
    handleProductBarcodeImageUpload
  } = useProductForm();

  const [labelSize, setLabelSize] = React.useState<"50x25" | "50x30" | "70x35" | "100x50">("50x30");

  const defaultSku = variantsList?.[0]?.subVariants?.[0]?.sku || "FX-PRODUCT";
  const activeBarcodeVal = barcode || defaultSku;

  const handlePrintSingleSticker = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Popup blocker prevented print window.", "error");
      return;
    }

    const dims: Record<string, { w: string; h: string }> = {
      "50x25": { w: "50mm", h: "25mm" },
      "50x30": { w: "50mm", h: "30mm" },
      "70x35": { w: "70mm", h: "35mm" },
      "100x50": { w: "100mm", h: "50mm" }
    };
    const targetDim = dims[labelSize] || dims["50x30"];

    const barcodeHtml = (barcodeSource === "image" && barcodeImage)
      ? `<img src="${barcodeImage}" style="max-height: 80%; max-width: 100%; object-fit: contain;" />`
      : getBarcodeSvgString(activeBarcodeVal, { width: 1.5, height: 35, displayValue: false });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sticker Print - ${activeBarcodeVal}</title>
          <style>
            @page {
              size: ${targetDim.w} ${targetDim.h};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 2mm;
              box-sizing: border-box;
              width: ${targetDim.w};
              height: ${targetDim.h};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              font-family: monospace;
              background: #ffffff;
              color: #000000;
              overflow: hidden;
            }
            .header-text {
              font-size: 8px;
              font-weight: bold;
              text-transform: uppercase;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .barcode-container {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              flex: 1;
            }
            .barcode-container svg {
              max-width: 100%;
              max-height: 100%;
            }
            .sku-text {
              font-size: 9px;
              font-weight: bold;
              letter-spacing: 0.5px;
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="position: fixed; top: 10px; right: 10px; z-index: 9999;">
            <button onclick="window.print()" style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">
              Print Thermal Sticker Label
            </button>
          </div>

          <div class="header-text">${title || "FlexSell Wholesale"}</div>
          <div class="barcode-container">
            ${barcodeHtml}
          </div>
          <div class="sku-text">${activeBarcodeVal}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Card className="border border-border bg-card text-foreground shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Product Barcode & Identification
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Code 128 barcode format. Select auto SKU, custom digit number, or physical image.
            </CardDescription>
          </div>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-primary/10 text-primary self-start sm:self-auto">
            MODE: {barcodeSource.toUpperCase()}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Mode Selector Tabs */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
            Select Barcode Option (Default is Auto Code 128)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setBarcodeSource("auto")}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                barcodeSource === "auto"
                  ? "border-primary bg-primary/10 font-bold shadow-sm"
                  : "border-border/60 hover:bg-secondary/20 text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">1. Auto (SKU Code 128)</span>
                {barcodeSource === "auto" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Generates scannable vector SVG Code 128 barcode from SKU.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setBarcodeSource("manual")}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                barcodeSource === "manual"
                  ? "border-primary bg-primary/10 font-bold shadow-sm"
                  : "border-border/60 hover:bg-secondary/20 text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">2. Custom Barcode String</span>
                {barcodeSource === "manual" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter custom EAN-13, UPC-A, GTIN or SKU code.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setBarcodeSource("image")}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                barcodeSource === "image"
                  ? "border-primary bg-primary/10 font-bold shadow-sm"
                  : "border-border/60 hover:bg-secondary/20 text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">3. Upload Barcode Image</span>
                {barcodeSource === "image" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Upload existing physical label image.
              </p>
            </button>
          </div>
        </div>

        {/* Input Controls Panel */}
        {barcodeSource === "manual" && (
          <div className="p-4 border rounded-xl bg-secondary/15 space-y-2">
            <label className="text-xs font-bold text-foreground block">Enter Barcode / SKU Number *</label>
            <Input
              type="text"
              placeholder="e.g. FS-HK-CHOP12-001"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="font-mono text-sm max-w-md bg-background"
            />
          </div>
        )}

        {barcodeSource === "image" && (
          <div className="p-4 border rounded-xl bg-secondary/15 space-y-3">
            <label className="text-xs font-bold text-foreground block">Upload Barcode Image *</label>

            {barcodeImage ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white border rounded-lg">
                <img
                  src={barcodeImage}
                  alt="Uploaded Barcode"
                  className="h-20 w-48 object-contain rounded border bg-gray-50 p-1"
                />
                <div className="space-y-1 flex-1">
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Image Uploaded & Verified
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBarcodeImage(null);
                      setBarcodeSource("auto");
                    }}
                    className="text-destructive hover:bg-destructive/10 h-7 text-xs font-semibold p-0 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Image
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-primary/30 rounded-xl bg-background hover:bg-primary/5 cursor-pointer transition-colors text-center">
                <Upload className="h-8 w-8 text-primary mb-2" />
                <span className="text-xs font-bold text-foreground">Click to Upload Barcode Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleProductBarcodeImageUpload}
                />
              </label>
            )}
          </div>
        )}

        {/* Thermal Sticker Print Controls */}
        <div className="p-4 border rounded-xl bg-card space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Single Sticker Thermal Print Controls
            </span>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-muted-foreground">Size:</span>
                <select
                  value={labelSize}
                  onChange={(e) => setLabelSize(e.target.value as any)}
                  className="bg-background text-foreground text-xs font-bold border rounded px-2 py-1"
                >
                  <option value="50x25">50mm x 25mm (Small)</option>
                  <option value="50x30">50mm x 30mm (Standard)</option>
                  <option value="70x35">70mm x 35mm (Medium)</option>
                  <option value="100x50">100mm x 50mm (Large Tag)</option>
                </select>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrintSingleSticker}
                className="h-8 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Print Thermal Sticker
              </Button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border text-black">
            {barcodeSource === "image" && barcodeImage ? (
              <div className="text-center space-y-1">
                <img src={barcodeImage} alt="Barcode Preview" className="h-16 max-w-full object-contain mx-auto" />
                <span className="text-[10px] font-mono font-bold block text-gray-700">Uploaded Barcode Label</span>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <Barcode sku={activeBarcodeVal} height={32} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
