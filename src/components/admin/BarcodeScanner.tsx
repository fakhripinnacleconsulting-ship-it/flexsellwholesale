"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Barcode } from "@/components/ui/Barcode";
import { formatPrice } from "@/lib/utils";
import { resolvePrice } from "@/lib/priceTierHelper";
import { getWarehouseLocation } from "@/services/barcodeResolver";
import { X, Search, QrCode, Minus, Plus, Camera, CameraOff, Upload, Lock, RefreshCw, Equal, CheckCircle2 } from "lucide-react";
import { useBarcodeScanner } from "./useBarcodeScanner";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVariant?: (resolved: any) => void;
  customerType?: "B2C" | "B2B" | "Dropshipping";
}

export function BarcodeScanner({ isOpen, onClose, onSelectVariant, customerType = "B2C" }: BarcodeScannerProps) {
  const isDocumentMode = !!onSelectVariant;

  const handleApplyVariant = (resolvedData?: any) => {
    const target = resolvedData || (scannedProduct && scannedSubVariant ? {
      product: scannedProduct,
      colorVariant: scannedVariant,
      subVariant: scannedSubVariant,
      price: resolvePrice(scannedSubVariant, customerType)
    } : null);

    if (target && onSelectVariant) {
      onSelectVariant(target);
      onClose();
    }
  };

  const {
    products,
    scanInput,
    setScanInput,
    scannedProduct,
    scannedVariant,
    scannedSubVariant,
    errorMsg,
    isScanning,
    inputRef,
    scanHistory,
    continuousScan,
    setContinuousScan,
    cameraMode,
    toggleCameraMode,
    availableCameras,
    selectedCameraId,
    setSelectedCameraId,
    handleScanSearch,
    handleFileUploadScan,
    startCamera,
    stopCamera,
    handleStockChange
  } = useBarcodeScanner(isOpen, customerType, (res) => {
    if (isDocumentMode) {
      handleApplyVariant(res);
    }
  });

  const [qtyInput, setQtyInput] = React.useState("1");

  // Handle Escape key & body scroll lock
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const parsedQty = parseInt(qtyInput, 10) || 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Scanner Modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm text-foreground"
    >
      <div className={`relative w-full ${isDocumentMode ? "max-w-xl" : "max-w-3xl"} bg-background rounded-xl border border-border shadow-2xl flex flex-col max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-extrabold">
                {isDocumentMode ? "Scan Barcode to Fill Item" : "Enterprise Barcode Scanner & SKU Audit"}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {isDocumentMode ? "Scan label or SKU to auto-populate document item fields" : "Code 128 • USB Scanner • Dual Camera Support"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Top Controls */}
          <div className="space-y-3">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isDocumentMode ? "Scan Barcode or Type SKU" : "Laser / USB / Manual SKU Lookup"}
              </label>

              <div className="flex items-center gap-3">
                {/* Camera Mode Toggles */}
                <div className="flex items-center rounded-lg border border-border bg-secondary/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => toggleCameraMode("rear")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      cameraMode === "rear"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" /> Rear Cam
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCameraMode("front")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                      cameraMode === "front"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Front Cam
                  </button>
                </div>

                {!isDocumentMode && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={continuousScan}
                      onChange={(e) => setContinuousScan(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    Continuous Mode
                  </label>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  data-barcode-input="true"
                  placeholder="Scan or paste SKU (e.g. FS-HK-CHOP12-001)..."
                  className="pl-9 font-mono uppercase text-sm"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleScanSearch(scanInput);
                  }}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleScanSearch(scanInput)} className="font-bold">
                  Lookup
                </Button>

                <Button
                  type="button"
                  variant={isScanning ? "destructive" : "secondary"}
                  onClick={() => (isScanning ? stopCamera() : startCamera())}
                  className="flex items-center gap-1.5 font-bold"
                >
                  {isScanning ? (
                    <>
                      <CameraOff className="h-4 w-4" /> Stop
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" /> Live Scan
                    </>
                  )}
                </Button>

                <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-xs font-semibold h-10 px-3 border border-border bg-secondary/30 hover:bg-secondary/60 text-foreground transition-colors gap-1.5">
                  <Upload className="h-4 w-4 text-primary" /> Image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUploadScan(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {availableCameras.length > 1 && (
              <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="font-semibold">Detected Camera Device:</span>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (isScanning) startCamera(cameraMode, e.target.value);
                  }}
                  className="bg-background border rounded px-2 py-1 text-foreground font-medium"
                >
                  {availableCameras.map(cam => (
                    <option key={cam.id} value={cam.id}>{cam.label}</option>
                  ))}
                </select>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Lock className="h-4 w-4 shrink-0" /> Barcode Notice
                </p>
                <p>{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Video Feed Window */}
          {isScanning && (
            <div className="relative w-full max-w-lg mx-auto aspect-[4/3] rounded-xl overflow-hidden border-2 border-primary bg-black shadow-2xl flex flex-col items-center justify-center">
              <div id="scanner-video-feed" className="w-full h-full"></div>
              <div className="absolute inset-x-4 h-0.5 bg-red-500 shadow-[0_0_15px_rgba(239,68,68,1)] animate-pulse top-1/2 pointer-events-none"></div>
              <div className="absolute bottom-3 bg-black/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md pointer-events-none flex items-center gap-2 border border-white/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="font-medium">
                  {cameraMode === "rear" ? "Rear Camera" : "Front Camera"} Active ({availableCameras.length || 1} available)
                </span>
              </div>
            </div>
          )}

          {/* DOCUMENT MODE VIEW */}
          {isDocumentMode ? (
            scannedProduct && scannedVariant && scannedSubVariant ? (
              <div className="p-4 border rounded-xl bg-primary/5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" /> Matched SubVariant
                    </span>
                    <h3 className="font-extrabold text-base text-foreground">{scannedProduct.title}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="font-mono font-bold bg-background px-2 py-0.5 rounded border">
                        SKU: {scannedSubVariant.sku}
                      </span>
                      <span>Color: <strong>{scannedVariant.color}</strong></span>
                      {scannedSubVariant.size && <span>Size: <strong>{scannedSubVariant.size}</strong></span>}
                      {scannedSubVariant.weight && <span>Weight: <strong>{scannedSubVariant.weight}</strong></span>}
                    </div>
                  </div>
                  <Barcode sku={scannedSubVariant.sku} height={28} />
                </div>

                <div className="flex justify-between items-center border-t pt-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Unit Price ({customerType}): </span>
                    <span className="font-extrabold text-foreground font-mono text-sm">
                      {formatPrice(resolvePrice(scannedSubVariant, customerType))}
                    </span>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleApplyVariant()}
                    className="font-bold text-xs"
                  >
                    Populate Document Form Fields
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center border-2 border-dashed rounded-xl bg-secondary/5 text-muted-foreground space-y-2">
                <QrCode className="h-10 w-10 mx-auto text-muted-foreground/30 animate-pulse" />
                <p className="text-xs font-medium max-w-sm mx-auto">
                  Scan a Code 128 barcode, connect a USB scanner, or type a SKU to select item details into document fields.
                </p>
              </div>
            )
          ) : (
            /* FULL AUDIT MODE for Products Manager */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Quick Catalog & History */}
              <div className="md:col-span-1 space-y-4 border-r pr-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Quick Catalog Select
                  </label>
                  <div className="space-y-1 max-h-44 overflow-y-auto border rounded-md p-2 bg-secondary/10">
                    {products.slice(0, 10).map((prod) => {
                      const firstSub = prod.colorVariants?.[0]?.subVariants?.[0];
                      const bcValue = firstSub?.sku || prod._id;
                      return (
                        <button
                          key={prod._id}
                          type="button"
                          onClick={() => handleScanSearch(bcValue)}
                          className="w-full text-left p-1.5 text-xs rounded hover:bg-primary/10 transition-colors truncate font-mono text-foreground block"
                        >
                          {prod.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {scanHistory.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                      Recent Scan Logs
                    </label>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto border rounded-md p-2 bg-secondary/5 text-[11px] font-mono">
                      {scanHistory.map((item, index) => (
                        <div key={index} className="flex justify-between items-center text-muted-foreground border-b last:border-0 pb-1">
                          <span className="truncate max-w-[120px]" title={item.productTitle}>{item.sku}</span>
                          <span className="text-[9px] text-primary">{item.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Audit & Stock Controls */}
              <div className="md:col-span-2 space-y-5">
                {scannedProduct && scannedVariant && scannedSubVariant ? (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b pb-4">
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-base leading-tight text-foreground">{scannedProduct.title}</h3>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="font-mono font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            SKU: {scannedSubVariant.sku}
                          </span>
                          <span>Color: <strong>{scannedVariant.color}</strong></span>
                          {scannedSubVariant.size && <span>Size: <strong>{scannedSubVariant.size}</strong></span>}
                          {scannedSubVariant.weight && <span>Weight: <strong>{scannedSubVariant.weight}</strong></span>}
                        </div>
                      </div>
                      <Barcode sku={scannedSubVariant.sku} height={32} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-secondary/20 p-3.5 rounded-xl border border-border">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Current Stock</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className={`text-2xl font-black ${
                            scannedSubVariant.stock > 25 ? "text-success" :
                            scannedSubVariant.stock > 10 ? "text-amber-500" :
                            "text-destructive"
                          }`}>{scannedSubVariant.stock}</span>
                          <span className="text-xs text-muted-foreground">units</span>
                        </div>
                      </div>

                      <div className="bg-secondary/20 p-3.5 rounded-xl border border-border">
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Warehouse Storage Bin</p>
                        <p className="text-xs font-bold text-foreground mt-2.5">
                          {getWarehouseLocation(scannedProduct.categoryId)}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-secondary/10 space-y-3">
                      <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground block">
                        Inventory Adjustment (Input Quantity):
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={qtyInput}
                          onChange={(e) => setQtyInput(e.target.value)}
                          placeholder="Quantity"
                          className="w-28 font-mono text-center font-bold h-9"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStockChange(parsedQty, "add")}
                          className="flex-1 text-success border-success/30 hover:bg-success/10 font-bold h-9"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add {parsedQty}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={scannedSubVariant.stock === 0}
                          onClick={() => handleStockChange(parsedQty, "sub")}
                          className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10 font-bold h-9"
                        >
                          <Minus className="h-3.5 w-3.5 mr-1" /> Deduct {parsedQty}
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStockChange(parsedQty, "set")}
                          className="flex-1 font-bold h-9"
                        >
                          <Equal className="h-3.5 w-3.5 mr-1" /> Set to {parsedQty}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-secondary/5">
                    <QrCode className="h-10 w-10 text-muted-foreground/30 animate-pulse mb-2" />
                    <p className="text-xs text-center max-w-xs">
                      Scan a Code 128 barcode label, connect a USB hardware scanner, or type a SKU to resolve exact sub-variant details.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t bg-secondary/10 rounded-b-xl">
          <Button onClick={onClose} variant="default" className="font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
