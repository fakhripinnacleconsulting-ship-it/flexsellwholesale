"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Product, Category } from "@/types";
import { Button } from "@/components/ui/Button";
import { Printer, X, QrCode, Building2, Mail, Calendar, ShieldCheck, Layers, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface B2BCatalogPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  categories?: Category[];
  catalogTitle: string;
  filterSummary?: string;
}

export interface CatalogVariantRow {
  rowId: string;
  productId: string;
  title: string;
  color: string;
  size: string;
  weight: string;
  sku: string;
  barcode: string;
  imageUrl: string;
  categoryName: string;
  hsnCode: string;
  gstRate: number;
  priceIncludesGst: boolean;
  mrp: number;
  b2bPrice: number;
  dropshippingPrice: number;
  moq: number;
  quantity: number;
  stock: number;
  description: string;
}

// Smart image resolver for specific color variants
function resolveVariantImage(product: Product, cvIdx: number): string {
  const cv = product.colorVariants?.[cvIdx];

  // 1. Specific image on current color variant
  if (cv?.images && cv.images.length > 0) {
    const firstImg = cv.images[0];
    const url = typeof firstImg === "string" ? firstImg : firstImg?.url;
    if (url) return url;
  }

  // 2. Primary color variant has multiple uploaded images indexed by cvIdx
  const primaryCv = product.colorVariants?.[0];
  if (primaryCv?.images && primaryCv.images.length > cvIdx) {
    const nthImg = primaryCv.images[cvIdx];
    const url = typeof nthImg === "string" ? nthImg : nthImg?.url;
    if (url) return url;
  }

  // 3. Fallback to primary variant first image
  if (primaryCv?.images && primaryCv.images.length > 0) {
    const firstImg = primaryCv.images[0];
    const url = typeof firstImg === "string" ? firstImg : firstImg?.url;
    if (url) return url;
  }

  return "/icon.png";
}

// Standalone fast product variant flattener
function flattenProductVariants(products: Product[], categories: Category[]): CatalogVariantRow[] {
  const categoryMap = new Map<string, string>();
  categories.forEach((c) => categoryMap.set(c._id, c.name));

  const rows: CatalogVariantRow[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const categoryName = categoryMap.get(product.categoryId) || "Wholesale Goods";
    const hsn = product.hsnCode ?? "3924";
    const gst = product.gstRate ?? 18;
    const desc = product.description ? product.description.replace(/<[^>]*>?/gm, "") : "";

    const colorVariants = product.colorVariants || [];
    if (colorVariants.length === 0) {
      rows.push({
        rowId: `${product._id}-default`,
        productId: product._id,
        title: product.title,
        color: "Standard",
        size: "Standard",
        weight: "",
        sku: "SKU-N/A",
        barcode: "",
        imageUrl: resolveVariantImage(product, 0),
        categoryName,
        hsnCode: hsn,
        gstRate: gst,
        priceIncludesGst: product.priceIncludesGst ?? true,
        mrp: 0,
        b2bPrice: 0,
        dropshippingPrice: 0,
        moq: 1,
        quantity: 1,
        stock: product.totalStock ?? 0,
        description: desc,
      });
      continue;
    }

    for (let cvIdx = 0; cvIdx < colorVariants.length; cvIdx++) {
      const cv = colorVariants[cvIdx];
      const colorName = cv.color || "Standard";
      const colorImg = resolveVariantImage(product, cvIdx);

      const subVariants = cv.subVariants || [];
      if (subVariants.length === 0) {
        rows.push({
          rowId: `${product._id}-${cvIdx}-default`,
          productId: product._id,
          title: product.title,
          color: colorName,
          size: "Standard",
          weight: "",
          sku: `SKU-${product._id.slice(-6)}`,
          barcode: "",
          imageUrl: colorImg,
          categoryName,
          hsnCode: hsn,
          gstRate: gst,
          priceIncludesGst: product.priceIncludesGst ?? true,
          mrp: 0,
          b2bPrice: 0,
          dropshippingPrice: 0,
          moq: 1,
          quantity: 1,
          stock: product.totalStock ?? 0,
          description: desc,
        });
        continue;
      }

      for (let svIdx = 0; svIdx < subVariants.length; svIdx++) {
        const sv = subVariants[svIdx];
        const b2bPrice = sv.b2bPrice || sv.b2cPrice || 0;
        const moq = sv.b2bMoq || 1;
        rows.push({
          rowId: `${product._id}-${cvIdx}-${sv.id || svIdx}`,
          productId: product._id,
          title: product.title,
          color: colorName,
          size: sv.size || "Standard",
          weight: sv.weight || "",
          sku: sv.sku || `SKU-${product._id.slice(-6)}`,
          barcode: sv.barcode || "",
          imageUrl: colorImg,
          categoryName,
          hsnCode: hsn,
          gstRate: gst,
          priceIncludesGst: product.priceIncludesGst ?? true,
          mrp: sv.mrp || 0,
          b2bPrice,
          dropshippingPrice: sv.dropshippingPrice || 0,
          moq,
          quantity: moq,
          stock: sv.stock ?? 0,
          description: desc,
        });
      }
    }
  }

  return rows;
}

// Memoized individual row renderer for instant deletion and quantity update performance
const CatalogTableRow = React.memo(function CatalogTableRow({
  row,
  onRemove,
  onQuantityChange,
}: {
  row: CatalogVariantRow;
  onRemove: (rowId: string) => void;
  onQuantityChange: (rowId: string, qty: number) => void;
}) {
  return (
    <tr className="hover:bg-secondary/10 transition-colors print-avoid-break">
      {/* 1. Variant Thumbnail Image */}
      <td className="p-3 text-center align-top">
        <div className="w-14 h-14 relative rounded-lg border border-border overflow-hidden bg-secondary/20 mx-auto shrink-0">
          <img
            src={row.imageUrl}
            alt={row.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </td>

      {/* 2. Product Name & Variant Specs & SKU */}
      <td className="p-3 align-top space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-bold text-foreground text-sm line-clamp-2">
            {row.title}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
          <span className="bg-secondary text-foreground px-2 py-0.5 rounded border border-border">
            Color: <strong className="text-primary">{row.color}</strong>
          </span>
          {row.size && row.size !== "Standard" && (
            <span className="bg-secondary text-foreground px-2 py-0.5 rounded border border-border">
              Size: <strong>{row.size}</strong>
            </span>
          )}
          {row.weight && (
            <span className="bg-secondary text-foreground px-2 py-0.5 rounded border border-border">
              Weight: <strong>{row.weight}</strong>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono pt-0.5">
          <span>SKU: {row.sku}</span>
          {row.barcode && <span>• Barcode: {row.barcode}</span>}
        </div>
      </td>

      {/* 3. HSN & GST */}
      <td className="p-3 align-top space-y-1">
        <p className="font-bold text-foreground text-xs font-mono">
          HSN: {row.hsnCode}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono">
          GST: {row.gstRate}%
        </p>
        <p className="text-[10px] text-muted-foreground">
          {row.priceIncludesGst ? "GST Incl." : "+ GST Extra"}
        </p>
      </td>

      {/* 4. Wholesale B2B Price */}
      <td className="p-3 align-top text-right space-y-0.5">
        <p className="text-sm font-black text-primary">
          ₹{row.b2bPrice.toLocaleString("en-IN")}
        </p>
        {row.mrp > row.b2bPrice && (
          <p className="text-[11px] text-muted-foreground line-through">
            MRP: ₹{row.mrp.toLocaleString("en-IN")}
          </p>
        )}
      </td>

      {/* 5. Quantity (Editable on Screen with MOQ Enforcement, Static Text on PDF/Print) */}
      <td className="p-3 align-top text-center space-y-1">
        {/* Screen View: Interactive stepper & input strictly enforcing MOQ */}
        <div className="no-print flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              onClick={() => onQuantityChange(row.rowId, Math.max(row.moq, row.quantity - 1))}
              disabled={row.quantity <= row.moq}
              className="h-7 w-7 rounded border border-border bg-secondary text-foreground text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-secondary/80 flex items-center justify-center cursor-pointer transition-colors"
              title={`Minimum order quantity is ${row.moq}`}
            >
              -
            </button>
            <input
              type="number"
              min={row.moq}
              value={row.quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onQuantityChange(row.rowId, isNaN(val) ? row.moq : val);
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < row.moq) {
                  onQuantityChange(row.rowId, row.moq);
                }
              }}
              className="w-16 text-center font-bold text-xs bg-background border border-border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            />
            <button
              type="button"
              onClick={() => onQuantityChange(row.rowId, row.quantity + 1)}
              className="h-7 w-7 rounded border border-border bg-secondary text-foreground text-xs font-bold hover:bg-secondary/80 flex items-center justify-center cursor-pointer transition-colors"
            >
              +
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            MOQ: {row.moq} pcs
          </span>
        </div>

        {/* Print View: Clean static text for PDF export */}
        <div className="hidden print:block text-center font-bold text-foreground text-xs">
          {row.quantity} pcs
        </div>
      </td>

      {/* 6. Screen-Only Action (Hidden on Print) */}
      <td className="p-3 align-top text-center no-print">
        <button
          type="button"
          onClick={() => onRemove(row.rowId)}
          className="no-print p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          title="Remove variant line from catalog"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
});

export function B2BCatalogPrintModal({
  isOpen,
  onClose,
  products,
  categories = [],
  catalogTitle,
  filterSummary,
}: B2BCatalogPrintModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [currentUrl, setCurrentUrl] = React.useState<string>("");
  const [activeRows, setActiveRows] = React.useState<CatalogVariantRow[]>([]);
  const prevIsOpenRef = React.useRef(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined" && isOpen) {
      setCurrentUrl(window.location.href);
    }
  }, [isOpen]);

  // Fast initialization: flatten products ONLY when modal transitions from closed to open
  React.useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setActiveRows(flattenProductVariants(products, categories));
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, products, categories]);

  // Instant deletion handler
  const handleRemoveRow = React.useCallback((rowId: string) => {
    setActiveRows((prev) => prev.filter((r) => r.rowId !== rowId));
  }, []);

  // Quantity change handler with strict MOQ enforcement
  const handleQuantityChange = React.useCallback((rowId: string, newQty: number) => {
    setActiveRows((prev) =>
      prev.map((r) => {
        if (r.rowId === rowId) {
          const validQty = isNaN(newQty) ? r.moq : Math.max(r.moq, newQty);
          return { ...r, quantity: validQty };
        }
        return r;
      })
    );
  }, []);

  if (!isOpen || !mounted) return null;

  const formattedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.print();
  };

  const modalContent = (
    <div className="b2b-print-modal-portal fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      
      {/* Screen Controls Header (Hidden on Print) */}
      <div className="no-print fixed top-4 right-4 z-50 flex items-center gap-3 bg-background/90 border border-border backdrop-blur-md p-2 rounded-xl shadow-2xl">
        <Button onClick={handlePrint} size="sm" className="gap-2 bg-primary text-primary-foreground font-semibold">
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
        <Button onClick={onClose} variant="outline" size="sm" className="gap-1 text-muted-foreground">
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>

      {/* Isolated Printable Catalog Document Container */}
      <div
        id="printable-b2b-catalog"
        className="bg-background text-foreground w-full max-w-5xl rounded-2xl border border-border shadow-2xl overflow-hidden my-auto"
      >
        {/* Printable Section Header */}
        <div className="p-6 md:p-8 bg-card border-b border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
            
            {/* Left Header: Brand & Catalog Information */}
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full">
                  FlexSell Wholesale
                </span>
                <span className="text-xs text-muted-foreground font-mono">B2B Sourcing Specification</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight uppercase">
                {catalogTitle}
              </h1>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 font-medium">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Date: {formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>Total Variant Lines: {activeRows.length} Lines</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>GSTIN: 23AAAAA0000A1Z5</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>sales@flexsellwholesale.com</span>
                </div>
              </div>

              {filterSummary && (
                <p className="text-xs text-primary font-semibold pt-1">
                  Active Filter Scope: {filterSummary}
                </p>
              )}
            </div>

            {/* Right Header: Dynamic QR Code Header */}
            <div className="flex flex-col items-center justify-center p-3 bg-secondary/30 rounded-xl border border-border/60 text-center shrink-0">
              {currentUrl ? (
                <QRCodeSVG value={currentUrl} size={92} level="M" includeMargin={false} />
              ) : (
                <div className="w-[92px] h-[92px] bg-secondary flex items-center justify-center rounded">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <span className="text-[10px] font-bold text-foreground mt-2 max-w-[130px] leading-tight">
                Scan to View Live Interactive Catalog
              </span>
              <span className="text-[9px] text-muted-foreground font-mono mt-0.5">
                Direct Bulk Sourcing
              </span>
            </div>

          </div>
        </div>

        {/* Structured Individual Product Variant Catalog Table */}
        <div className="p-4 sm:p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-secondary/40 border-b border-border text-foreground font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3 w-16 text-center">Image</th>
                  <th className="p-3">Product Name & Variant Specs</th>
                  <th className="p-3 w-28">HSN</th>
                  <th className="p-3 w-32 text-right">B2B Price</th>
                  <th className="p-3 w-36 text-center">Quantity</th>
                  <th className="p-3 w-12 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground italic">
                      No variant lines remaining in catalog. Close dialog to reset.
                    </td>
                  </tr>
                ) : (
                  activeRows.map((row) => (
                    <CatalogTableRow
                      key={row.rowId}
                      row={row}
                      onRemove={handleRemoveRow}
                      onQuantityChange={handleQuantityChange}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commercial Terms & Sourcing Footer */}
        <div className="p-6 bg-secondary/30 border-t border-border text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-1.5 text-foreground font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span>FlexSell B2B Wholesale Sourcing Terms</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-[11px] list-disc list-inside">
            <li>Minimum Order Quantity (MOQ) applies per variant as indicated above.</li>
            <li>Prices are subject to market change and availability at checkout.</li>
            <li>Freight charges calculated based on volumetric weight at time of order.</li>
            <li>For customized volume tier orders or OEM packaging, contact sales support.</li>
          </ul>
          <div className="pt-2 text-center text-[10px] text-muted-foreground font-mono border-t border-border/40 mt-3">
            Generated via FlexSell Wholesale Platform • Page Document Ref: FS-CAT-{Date.now().toString().slice(-6)}
          </div>
        </div>

      </div>

      {/* Embedded Strict Print CSS Rule to prevent multiple / duplicate document printing */}
      <style jsx global>{`
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
          }
          body > *:not(.b2b-print-modal-portal) {
            display: none !important;
          }
          .b2b-print-modal-portal {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          #printable-b2b-catalog {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

    </div>
  );

  return createPortal(modalContent, document.body);
}
