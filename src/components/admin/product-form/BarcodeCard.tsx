"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Barcode } from "@/components/ui/Barcode";
import { useProductForm } from "./ProductFormContext";
import { Upload, Download, Trash2, CheckCircle2, ShieldCheck } from "lucide-react";
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

  const defaultSku = variantsList?.[0]?.subVariants?.[0]?.sku || "FX-PRODUCT";
  const activeBarcodeVal = barcode || defaultSku;

  return (
    <Card className="border border-border bg-card text-foreground shadow-sm">
      <CardHeader className="border-b pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Product Barcode & Identification
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Set one barcode for this product. Choose auto-generated SKU barcode, custom digit number, or upload a physical barcode image.
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
            Select Barcode Option (Default is Auto)
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
                <span className="text-xs font-bold text-foreground">1. Auto (SKU Barcode)</span>
                {barcodeSource === "auto" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Generates vector SVG Code-128 barcode from SKU.
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
                <span className="text-xs font-bold text-foreground">2. Custom Barcode Number</span>
                {barcodeSource === "manual" && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Enter EAN-13, UPC-A, GTIN or custom digits.
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
                Upload existing physical manufacturer barcode label image.
              </p>
            </button>
          </div>
        </div>

        {/* Input Controls Panel */}
        {barcodeSource === "manual" && (
          <div className="p-4 border rounded-xl bg-secondary/15 space-y-2">
            <label className="text-xs font-bold text-foreground block">Enter Barcode Number / String *</label>
            <Input
              type="text"
              placeholder="e.g. 8901234567890"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="font-mono text-sm max-w-md bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Valid barcode characters: alphanumeric numbers (EAN-13, UPC, Code-128).
            </p>
          </div>
        )}

        {barcodeSource === "image" && (
          <div className="p-4 border rounded-xl bg-secondary/15 space-y-3">
            <label className="text-xs font-bold text-foreground block">Upload Manufacturer / Physical Barcode Image *</label>
            
            {barcodeImage ? (
              <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-white border rounded-lg">
                <img
                  src={barcodeImage}
                  alt="Uploaded Barcode"
                  className="h-20 w-48 object-contain rounded border bg-gray-50 p-1"
                />
                <div className="space-y-1 flex-1">
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> Barcode Image Uploaded & Verified
                  </span>
                  <p className="text-[11px] font-mono text-gray-600 truncate max-w-xs" title={barcodeImage}>
                    {barcodeImage}
                  </p>
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
                <span className="text-xs font-bold text-foreground">Click to Upload Existing Barcode Image</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Supported Formats: PNG, JPEG, WebP, SVG (Max 5MB)</span>
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

        {/* Live Preview Card & Print Action */}
        <div className="p-4 border rounded-xl bg-card space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Product Barcode Preview</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const printWindow = window.open("", "_blank");
                if (!printWindow) {
                  addToast("Popup blocker prevented printing.", "error");
                  return;
                }

                const barcodeHtml = (barcodeSource === "image" && barcodeImage)
                  ? `<img src="${barcodeImage}" style="max-height: 90px; max-width: 100%; object-fit: contain;" />`
                  : getBarcodeSvgString(activeBarcodeVal, 1, 30);

                printWindow.document.write(`
                  <html>
                    <head>
                      <title>Barcode Print - ${title || "Product"}</title>
                      <style>
                        body { display: flex; justify-content: center; align-items: center; height: 90vh; font-family: sans-serif; background: #fff; }
                        .card { text-align: center; width: 240px; border: 2px solid #000; padding: 16px; }
                        @media print { button { display: none; } }
                      </style>
                    </head>
                    <body>
                      <div style="text-align:center;">
                        <button onclick="window.print()" style="padding: 8px 16px; margin-bottom: 15px; cursor: pointer; background: #10b981; color: white; border: none; border-radius: 4px; font-weight: bold;">
                          Print Product Barcode
                        </button>
                        <div class="card">
                          <div style="font-size:14px; font-weight:bold; margin-bottom:6px; text-transform:uppercase;">${title || 'Product'}</div>
                          <div style="display:flex; justify-content:center; margin-bottom:8px;">
                            ${barcodeHtml}
                          </div>
                          <div style="font-size:11px; font-weight:bold; font-family:monospace;">${activeBarcodeVal}</div>
                        </div>
                      </div>
                    </body>
                  </html>
                `);
                printWindow.document.close();
              }}
              className="h-8 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Print Barcode Label
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg border text-black">
            {barcodeSource === "image" && barcodeImage ? (
              <div className="text-center space-y-1">
                <img src={barcodeImage} alt="Barcode Preview" className="h-16 max-w-full object-contain mx-auto" />
                <span className="text-[10px] font-mono font-bold block text-gray-700">Uploaded Barcode Label Image</span>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <Barcode sku={activeBarcodeVal} height={28} />
                <span className="text-xs font-mono font-extrabold block">{activeBarcodeVal}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
