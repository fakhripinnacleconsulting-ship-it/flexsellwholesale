"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  Download,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Loader2,
  X,
  FileSpreadsheet,
  Trash2,
  QrCode
} from "lucide-react";
import { Product, Category, HsnRecord } from "@/types";
import { type ExcelValidationError } from "@/lib/excelHelper";
import { useToastStore } from "@/stores/toastStore";
import { BulkExportPanel } from "./bulk-operations/BulkExportPanel";
import { BulkImportPanel } from "./bulk-operations/BulkImportPanel";
import { BulkValidationPanel } from "./bulk-operations/BulkValidationPanel";

interface BulkOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories: Category[];
  hsns: HsnRecord[];
  selectedProductIds: string[];
  onImportSuccess: () => void;
  onBulkDelete: () => void;
  onBulkPrintBarcodes: () => void;
}

export function BulkOperationsModal({
  isOpen,
  onClose,
  products,
  categories,
  hsns,
  selectedProductIds,
  onImportSuccess,
  onBulkDelete,
  onBulkPrintBarcodes
}: BulkOperationsModalProps) {
  const { addToast } = useToastStore();
  
  const [dragActive, setDragActive] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  
  const [parsedData, setParsedData] = React.useState<any[] | null>(null);
  const [validationErrors, setValidationErrors] = React.useState<ExcelValidationError[]>([]);
  const [fileInfo, setFileInfo] = React.useState<{ name: string; size: number } | null>(null);
  const [importStats, setImportStats] = React.useState<{
    productsCount: number;
    variantsCount: number;
    combinationsCount: number;
  } | null>(null);

  // Reset state when opening/closing
  React.useEffect(() => {
    if (!isOpen) {
      setParsedData(null);
      setValidationErrors([]);
      setFileInfo(null);
      setImportStats(null);
      setIsParsing(false);
      setIsUploading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const downloadFromServer = async (url: string, defaultFilename: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      const errJson = await response.json();
      throw new Error(errJson.message || "Failed to download file from server");
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const processFile = async (file: File) => {
    if (!file) return;
    
    // Check extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "xls") {
      addToast("Unsupported file format. Please upload an Excel (.xlsx) file.", "error");
      return;
    }

    setFileInfo({ name: file.name, size: file.size });
    setIsParsing(true);
    setValidationErrors([]);
    setParsedData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const matches = document.cookie.match(/csrf_token=([^;]+)/);
      const csrfToken = matches ? matches[1] : null;
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      const response = await fetch("/api/products/import", {
        method: "POST",
        headers,
        body: formData,
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.message || "Failed to parse Excel file.");
      }

      setValidationErrors(resJson.errors || []);
      setParsedData(resJson.products || []);
      setImportStats(resJson.stats || null);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to parse Excel file.", "error");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleExportTemplate = async () => {
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      await downloadFromServer(`/api/products/export?template=true`, `flexsell_add_products_${timestamp}.xlsx`);
      addToast("Excel template downloaded successfully.", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to download template.", "error");
    }
  };

  const handleExportSelected = async () => {
    if (selectedProductIds.length === 0) {
      addToast("No products selected. Please select products to export.", "warning");
      return;
    }
    try {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
      await downloadFromServer(
        `/api/products/export?ids=${selectedProductIds.join(",")}`,
        `flexsell_update_products_${timestamp}.xlsx`
      );
      addToast(`Exported selected products successfully.`, "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to export products.", "error");
    }
  };

  const handleConfirmUpload = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setIsUploading(true);
    try {
      const matches = document.cookie.match(/csrf_token=([^;]+)/);
      const csrfToken = matches ? matches[1] : null;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }

      const response = await fetch("/api/products/bulk", {
        method: "POST",
        headers,
        body: JSON.stringify({ products: parsedData })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.message || "Failed to import products.");
      }

      const { summary } = resJson;
      const successMsg = `Import completed! Inserted: ${summary.inserted}, Updated: ${summary.updated}.`;
      
      if (summary.errors && summary.errors.length > 0) {
        addToast(`${successMsg} Note: ${summary.errors.length} rows failed.`, "warning");
        // Print errors in console for debugging
        console.error("Bulk Import Row Failures:", summary.errors);
      } else {
        addToast(successMsg, "success");
      }

      onImportSuccess();
      onClose();
    } catch (err: unknown) {
      addToast((err as any).message || "Error importing products.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Determine validation status
  const criticalErrors = validationErrors.filter((e) => e.type === "error");
  const warnings = validationErrors.filter((e) => e.type === "warning");
  const hasErrors = criticalErrors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="max-w-4xl w-full border-border max-h-[90vh] flex flex-col bg-background shadow-2xl relative animate-in zoom-in-95 duration-250">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary/40"
        >
          <X className="h-5 w-5" />
        </button>

        <CardHeader className="border-b px-6 py-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <FileSpreadsheet className="h-5.5 w-5.5 text-primary" />
            <span>Bulk Product Operations</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Export & Actions Panel */}
          <BulkExportPanel
            handleExportTemplate={handleExportTemplate}
            handleExportSelected={handleExportSelected}
            selectedProductIds={selectedProductIds}
            onBulkPrintBarcodes={onBulkPrintBarcodes}
            onBulkDelete={onBulkDelete}
            onClose={onClose}
          />

          <div className="border-t border-border/60 my-6"></div>

          {/* Import Drag & Drop Zone */}
          <BulkImportPanel
            fileInfo={fileInfo}
            dragActive={dragActive}
            handleDrag={handleDrag}
            handleDrop={handleDrop}
            handleFileChange={handleFileChange}
            clearFile={() => {
              setFileInfo(null);
              setParsedData(null);
              setValidationErrors([]);
              setImportStats(null);
            }}
          />

          {/* Parsing States */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">Parsing and validating Excel file...</span>
            </div>
          )}

          {/* Validation Results & Collision Dialog List */}
          {parsedData && (
            <BulkValidationPanel
              importStats={importStats}
              validationErrors={validationErrors}
            />
          )}

        </CardContent>

        {/* Modal Footer */}
        <div className="border-t px-6 py-4 bg-secondary/20 rounded-b-2xl flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          
          {parsedData && (
            <Button
              onClick={handleConfirmUpload}
              disabled={hasErrors || isUploading || isParsing || parsedData.length === 0}
              className="bg-primary hover:bg-primary/95 text-white font-bold flex items-center gap-1.5 min-w-[120px]"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Importing...
                </>
              ) : (
                <>
                  Confirm & Upload
                </>
              )}
            </Button>
          )}
        </div>

      </Card>
    </div>
  );
}
