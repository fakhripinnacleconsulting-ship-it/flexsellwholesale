"use client";

import * as React from "react";
import { Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getBarcodeSvgString } from "@/lib/barcodeHelper";
import { useToastStore } from "@/stores/toastStore";
import { Printer, X, CheckSquare, Square, Search, Layers, FileText } from "lucide-react";

import { triggerPrintWithTitle, generateDocumentTitle } from "@/lib/pdfPrintHelper";

interface BarcodeSheetDownloadProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export function BarcodeSheetDownload({ isOpen, onClose, products }: BarcodeSheetDownloadProps) {
  const { addToast } = useToastStore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [gridPreset, setGridPreset] = React.useState<"24" | "30" | "40">("30");

  // Flattened SubVariant items
  const allVariants = React.useMemo(() => {
    const list: Array<{
      id: string;
      productTitle: string;
      color: string;
      size: string;
      weight: string;
      sku: string;
      stock: number;
    }> = [];

    products.forEach((prod) => {
      prod.colorVariants?.forEach((cv) => {
        cv.subVariants?.forEach((sv) => {
          list.push({
            id: sv.id,
            productTitle: prod.title,
            color: cv.color,
            size: sv.size || "",
            weight: sv.weight || "",
            sku: sv.sku,
            stock: sv.stock
          });
        });
      });
    });

    return list;
  }, [products]);

  // Selected items & individual print quantities map: { [sku]: quantity }
  const [selectedSkus, setSelectedSkus] = React.useState<Record<string, boolean>>({});
  const [skuQuantities, setSkuQuantities] = React.useState<Record<string, number>>({});

  // Initialize all selected by default
  React.useEffect(() => {
    if (isOpen && allVariants.length > 0) {
      const initialSel: Record<string, boolean> = {};
      const initialQty: Record<string, number> = {};
      allVariants.forEach((v) => {
        initialSel[v.sku] = true;
        initialQty[v.sku] = 1;
      });
      setSelectedSkus(initialSel);
      setSkuQuantities(initialQty);
    }
  }, [isOpen, allVariants]);

  if (!isOpen) return null;

  const filteredVariants = allVariants.filter(
    (v) =>
      v.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.color.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSelectedCount = Object.keys(selectedSkus).filter((sku) => selectedSkus[sku]).length;
  const totalLabelsToPrint = Object.keys(selectedSkus).reduce((sum, sku) => {
    return selectedSkus[sku] ? sum + (skuQuantities[sku] || 1) : sum;
  }, 0);

  const toggleSelectAll = () => {
    const allFilteredSelected = filteredVariants.every((v) => selectedSkus[v.sku]);
    const updated = { ...selectedSkus };
    filteredVariants.forEach((v) => {
      updated[v.sku] = !allFilteredSelected;
    });
    setSelectedSkus(updated);
  };

  const handlePrintA4Sheet = () => {
    if (totalLabelsToPrint === 0) {
      addToast("Please select at least one SKU to print.", "warning");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Popup blocker prevented print window.", "error");
      return;
    }

    // Build flattened array of items repeated by quantity
    const itemsToPrint: Array<(typeof allVariants)[0]> = [];
    allVariants.forEach((v) => {
      if (selectedSkus[v.sku]) {
        const qty = Math.max(1, skuQuantities[v.sku] || 1);
        for (let i = 0; i < qty; i++) {
          itemsToPrint.push(v);
        }
      }
    });

    const cols = gridPreset === "40" ? 4 : 3;

    let cellsHtml = "";
    itemsToPrint.forEach((item) => {
      const barcodeSvg = getBarcodeSvgString(item.sku, { width: 1.2, height: 32, displayValue: false });
      const variantMeta = [item.color, item.size, item.weight].filter(Boolean).join(" • ");

      cellsHtml += `
        <div class="label-card">
          <div class="label-header">
            <span class="sku-tag">${item.sku}</span>
            <span class="product-name">${item.productTitle}</span>
          </div>
          <div class="variant-meta">${variantMeta}</div>
          <div class="barcode-svg">${barcodeSvg}</div>
          <div class="code-text">${item.sku}</div>
        </div>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${generateDocumentTitle("Barcode_Labels", "Sheet")}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: system-ui, -apple-system, sans-serif;
              background: #ffffff;
              color: #000000;
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap: 4mm 3mm;
              width: 100%;
            }
            .label-card {
              border: 1px dashed #d1d5db;
              border-radius: 4px;
              padding: 2.5mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              height: ${gridPreset === "24" ? "33mm" : gridPreset === "30" ? "27mm" : "26mm"};
              overflow: hidden;
              page-break-inside: avoid;
              background: #fff;
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 2mm;
              font-size: 7.5pt;
              font-weight: 700;
              line-height: 1.1;
            }
            .sku-tag {
              font-family: monospace;
              font-size: 7.5pt;
              color: #000;
              background: #f3f4f6;
              padding: 1px 3px;
              border-radius: 2px;
              white-space: nowrap;
            }
            .product-name {
              text-align: right;
              font-size: 7pt;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 60%;
            }
            .variant-meta {
              font-size: 6.5pt;
              color: #4b5563;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-top: 1px;
            }
            .barcode-svg {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 1.5mm 0 0.5mm 0;
              flex: 1;
            }
            .barcode-svg svg {
              max-width: 100%;
              max-height: 100%;
            }
            .code-text {
              text-align: center;
              font-family: monospace;
              font-size: 7.5pt;
              font-weight: bold;
              letter-spacing: 0.5px;
            }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="position: fixed; top: 12px; right: 12px; z-index: 9999;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              Print A4 Barcode Sheet (${totalLabelsToPrint} Labels)
            </button>
          </div>

          <div class="grid-container">
            ${cellsHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="A4 Barcode Sheet Modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm text-foreground"
    >
      <div className="relative w-full max-w-4xl bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-extrabold">Download A4 Barcode Batch Sheet</h2>
              <p className="text-xs text-muted-foreground">
                Batch print Code 128 barcodes arranged in sequence on A4 pages.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/10 p-4 rounded-xl border">
            <div className="relative flex-1 w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by SKU, Product Title, or Color..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-muted-foreground">Grid Preset:</span>
                <select
                  value={gridPreset}
                  onChange={(e) => setGridPreset(e.target.value as any)}
                  className="bg-background text-foreground text-xs font-bold border rounded px-2 py-1"
                >
                  <option value="24">24 per sheet (3x8 - Large)</option>
                  <option value="30">30 per sheet (3x10 - Standard)</option>
                  <option value="40">40 per sheet (4x10 - Compact)</option>
                </select>
              </div>

              <Button onClick={handlePrintA4Sheet} className="font-bold text-xs flex items-center gap-1.5">
                <Printer className="h-4 w-4" /> Print Sheet ({totalLabelsToPrint})
              </Button>
            </div>
          </div>

          {/* SubVariant Selection Table */}
          <div className="border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-3 bg-secondary/20 border-b text-xs font-bold">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer"
              >
                {filteredVariants.length > 0 && filteredVariants.every((v) => selectedSkus[v.sku]) ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4 text-muted-foreground" />
                )}
                <span>Select All ({totalSelectedCount} of {allVariants.length} selected)</span>
              </button>
              <span className="text-muted-foreground font-mono">Total Labels: {totalLabelsToPrint}</span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y">
              {filteredVariants.length > 0 ? (
                filteredVariants.map((item) => {
                  const isChecked = !!selectedSkus[item.sku];
                  const qty = skuQuantities[item.sku] || 1;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 text-xs transition-colors ${
                        isChecked ? "bg-primary/5" : "hover:bg-secondary/10"
                      }`}
                    >
                      <label className="flex items-center gap-3 flex-1 cursor-pointer min-w-0 pr-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) =>
                            setSelectedSkus((prev) => ({ ...prev, [item.sku]: e.target.checked }))
                          }
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{item.productTitle}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Color: {item.color} | Size: {item.size || "Std"} | Weight: {item.weight || "250g"}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                          {item.sku}
                        </span>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground font-medium">Qty:</span>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          value={qty}
                          disabled={!isChecked}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 1;
                            setSkuQuantities((prev) => ({ ...prev, [item.sku]: val }));
                          }}
                          className="w-16 h-8 text-center text-xs font-mono font-bold"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No matching variants found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-secondary/10 rounded-b-xl">
          <span className="text-xs text-muted-foreground font-medium">
            Page Break preview: ~{Math.ceil(totalLabelsToPrint / parseInt(gridPreset, 10)) || 1} A4 page(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handlePrintA4Sheet} className="font-bold">
              Generate & Print Barcode Sheet
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
