import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Download, QrCode, Trash2 } from "lucide-react";

interface BulkExportPanelProps {
  handleExportTemplate: () => void;
  handleExportSelected: () => void;
  selectedProductIds: string[];
  onBulkPrintBarcodes: () => void;
  onBulkDelete: () => void;
  onClose: () => void;
}

export function BulkExportPanel({
  handleExportTemplate,
  handleExportSelected,
  selectedProductIds,
  onBulkPrintBarcodes,
  onBulkDelete,
  onClose,
}: BulkExportPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border/80 bg-secondary/10 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground">A. Add New Products</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Download a blank Excel template structured with correct headers, descriptions, and reference tabs to start fresh.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportTemplate}
            className="mt-4 font-semibold w-full flex items-center justify-center gap-1.5"
          >
            <Download className="h-4 w-4" /> Download Blank Template
          </Button>
        </div>

        <div className="border border-border/80 bg-secondary/10 p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-foreground">B. Update Existing Products</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Export selected products in catalog to modify titles, descriptions, pricing, inventory, or variants, then re-import.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSelected}
            disabled={selectedProductIds.length === 0}
            className="mt-4 font-semibold w-full flex items-center justify-center gap-1.5"
          >
            <Download className="h-4 w-4" /> 
            Export Selected ({selectedProductIds.length})
          </Button>
        </div>
      </div>

      {selectedProductIds.length > 0 && (
        <div className="border border-primary/20 bg-primary/5 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div>
            <h3 className="font-bold text-xs text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full font-black">
                {selectedProductIds.length}
              </span>
              Selected Products Actions
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Execute catalog or barcode operations on the selected batch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelected}
              className="text-xs font-semibold flex items-center gap-1.5 bg-background"
            >
              <Download className="h-3.5 w-3.5" /> Export Data
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkPrintBarcodes}
              className="text-xs font-semibold flex items-center gap-1.5 bg-background text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              <QrCode className="h-3.5 w-3.5" /> Print Barcodes
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onClose();
                onBulkDelete();
              }}
              className="text-xs font-bold flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
