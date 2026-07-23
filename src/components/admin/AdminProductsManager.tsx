"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Plus, Edit, Trash2, QrCode, ExternalLink, Download, AlertCircle, FileSpreadsheet } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useProductStore } from "@/stores/productStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useHsnStore } from "@/stores/hsnStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { Product, Category, ColorVariant, SubVariant } from "@/types";
import { BarcodeScanner } from "./BarcodeScanner";
import { Barcode } from "@/components/ui/Barcode";
import { Pagination } from "@/components/ui/Pagination";
import { getBarcodeSvgString } from "@/lib/barcodeHelper";
import { calculateProductRelevanceScore } from "@/services/searchService";
import { resolvePrice } from "@/lib/priceTierHelper";
import { InventoryManager } from "./InventoryManager";
import { BulkOperationsModal } from "./BulkOperationsModal";
import { ProductFilters } from "./products/ProductFilters";
import { ProductTable } from "./products/ProductTable";

interface AdminProductsManagerProps {
  initialProducts: Product[];
  initialCategories: Category[];
}

export function AdminProductsManager({ initialProducts, initialCategories }: AdminProductsManagerProps) {
  const { products, initializeProducts, updateProduct, deleteProduct, bulkDeleteProducts } = useProductStore();
  const { categories, initializeCategories } = useCategoryStore();
  const { hsns, initializeHsns } = useHsnStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [selectedHsn, setSelectedHsn] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedStockStatus, setSelectedStockStatus] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("title-asc");

  const [isScannerOpen, setIsScannerOpen] = React.useState(false);
  const [isBulkOpen, setIsBulkOpen] = React.useState(false);
  const [barcodePrintProduct, setBarcodePrintProduct] = React.useState<Product | null>(null);
  const [activePanel, setActivePanel] = React.useState<"catalog" | "inventory">("catalog");

  // Multi-select bulk state
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 10;

  const [globalHighlightPrice, setGlobalHighlightPrice] = React.useState<"B2C" | "B2B" | "Dropshipping" | "">("");

  // Fetch current global highlight price from CMS configuration
  React.useEffect(() => {
    fetch("/api/cms")
      .then(res => res.json())
      .then(data => {
        if (data.globalHighlightPrice) {
          setGlobalHighlightPrice(data.globalHighlightPrice);
        } else {
          setGlobalHighlightPrice("B2C");
        }
      })
      .catch(err => {
        console.error("Failed to load global highlight price", err);
        setGlobalHighlightPrice("B2C");
      });
  }, []);

  const handleGlobalHighlightPriceChange = async (tier: "B2C" | "B2B" | "Dropshipping") => {
    setGlobalHighlightPrice(tier);
    try {
      const res = await fetch("/api/products/global-highlight-price", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultPriceTier: tier })
      });
      if (!res.ok) throw new Error("Failed to update global highlight price");
      
      addToast(`Successfully set global highlight price to ${tier} for all products!`, "success");
      
      // Force refresh of products in store to update UI instantly!
      await initializeProducts(undefined, true);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to update global highlight price", "error");
    }
  };

  // Sync server data into client stores
  React.useEffect(() => {
    initializeProducts(initialProducts);
    initializeCategories(initialCategories);
    initializeHsns();
  }, [initialProducts, initialCategories, initializeProducts, initializeCategories, initializeHsns]);

  const activeProducts = products.length > 0 ? products : initialProducts;
  const activeCategories = categories.length > 0 ? categories : initialCategories;

  // Reset page & selections when filters change
  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedProductIds([]);
  }, [searchTerm, selectedCategory, selectedHsn, selectedStatus, selectedStockStatus, sortBy]);

  // Filters & Sorting logic
  const processedProducts = React.useMemo(() => {
    let list = [...activeProducts];

    const catMap = new Map<string, Category>(activeCategories.map(c => [c._id, c]));

    // Text Search with SKU priority scoring
    if (searchTerm.trim()) {
      list = list
        .map(p => ({
          product: p,
          score: calculateProductRelevanceScore(p, searchTerm, catMap).score
        }))
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.product);
    }

    // Category Filter
    if (selectedCategory !== "all") {
      list = list.filter(p => p.categoryId === selectedCategory);
    }

    // HSN Code Filter
    if (selectedHsn !== "all") {
      list = list.filter(p => p.hsnCode === selectedHsn);
    }

    // Active Status Filter
    if (selectedStatus !== "all") {
      const isProductActive = selectedStatus === "active";
      list = list.filter(p => p.isActive === isProductActive);
    }

    // Stock Level Filter
    if (selectedStockStatus !== "all") {
      if (selectedStockStatus === "instock") {
        list = list.filter(p => p.totalStock > 20);
      } else if (selectedStockStatus === "lowstock") {
        list = list.filter(p => p.totalStock > 0 && p.totalStock <= 20);
      } else if (selectedStockStatus === "outofstock") {
        list = list.filter(p => p.totalStock === 0);
      }
    }

    // Sorting
    list.sort((a, b) => {
      const svA = a.colorVariants?.[0]?.subVariants?.[0];
      const priceA = svA ? resolvePrice(svA, a.defaultPriceTier || "B2C") : 0;
      const svB = b.colorVariants?.[0]?.subVariants?.[0];
      const priceB = svB ? resolvePrice(svB, b.defaultPriceTier || "B2C") : 0;

      switch (sortBy) {
        case "title-asc":
          return a.title.localeCompare(b.title);
        case "title-desc":
          return b.title.localeCompare(a.title);
        case "price-asc":
          return priceA - priceB;
        case "price-desc":
          return priceB - priceA;
        case "stock-asc":
          return a.totalStock - b.totalStock;
        case "stock-desc":
          return b.totalStock - a.totalStock;
        default:
          return 0;
      }
    });

    return list;
  }, [activeProducts, searchTerm, selectedCategory, selectedHsn, selectedStatus, selectedStockStatus, sortBy]);

  const totalPages = Math.ceil(processedProducts.length / ITEMS_PER_PAGE);

  const paginatedProducts = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [processedProducts, currentPage]);

  const toggleProductActive = (id: string, currentStatus: boolean) => {
    const product = activeProducts.find(p => p._id === id);
    confirmAction({
      title: currentStatus ? "Deactivate Product" : "Activate Product",
      message: `Are you sure you want to ${currentStatus ? "deactivate (hide)" : "activate (show)"} the product "${product?.title || 'this item'}" on the storefront?`,
      confirmText: currentStatus ? "Deactivate" : "Activate",
      cancelText: "Cancel",
      type: currentStatus ? "danger" : "info",
      onConfirm: async () => {
        try {
          await updateProduct(id, { isActive: !currentStatus });
          addToast(
            `Product status toggled to ${!currentStatus ? "Active" : "Inactive"}.`,
            "success"
          );
        } catch (err) {
          addToast(
            err instanceof Error ? (err as any).message : "Failed to toggle product status",
            "error"
          );
        }
      }
    });
  };

  const handleDeleteProduct = (id: string) => {
    const product = activeProducts.find(p => p._id === id);
    confirmAction({
      title: "Delete Product",
      message: `Are you sure you want to permanently delete the product "${product?.title || 'this item'}"? This action is permanent and cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteProduct(id);
          setSelectedProductIds(prev => prev.filter(pId => pId !== id));
          addToast("Product successfully removed from catalog.", "success");
        } catch (err) {
          addToast(
            err instanceof Error ? (err as any).message : "Failed to delete product",
            "error"
          );
        }
      }
    });
  };

  // Row selection helpers
  const handleSelectRow = (productId: string) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = paginatedProducts.map(p => p._id);
    const allSelected = pageIds.every(id => selectedProductIds.includes(id));

    if (allSelected) {
      setSelectedProductIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedProductIds(prev => {
        const union = new Set([...prev, ...pageIds]);
        return Array.from(union);
      });
    }
  };

  // Bulk actions handlers
  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    confirmAction({
      title: "Bulk Delete Products",
      message: `Are you sure you want to permanently delete the ${selectedProductIds.length} selected products? This action cannot be undone.`,
      confirmText: "Delete Bulk",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await bulkDeleteProducts(selectedProductIds);
          addToast(`Successfully deleted ${selectedProductIds.length} products in bulk!`, "success");
          setSelectedProductIds([]);
        } catch (err) {
          addToast(
            err instanceof Error ? (err as any).message : "Failed to delete products",
            "error"
          );
        }
      }
    });
  };

  const handleBulkDownloadBarcodes = () => {
    if (selectedProductIds.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Popup blocker prevented printing.", "error");
      return;
    }

    const selectedProducts = activeProducts.filter(p => selectedProductIds.includes(p._id));
    let cardsHtml = "";
    selectedProducts.forEach(product => {
      product.colorVariants.forEach(cv => {
        cv.subVariants?.forEach(sv => {
          const barValue = sv.barcode || sv.sku || "FX0000";
          cardsHtml += `
            <div style="text-align:center; width:140px; margin:10px; display:inline-block; box-sizing:border-box;">
              <div style="display:flex; justify-content:center; margin-bottom:4px;">
                ${getBarcodeSvgString(barValue, 0.8, 24)}
              </div>
              <div style="font-size:10px; font-weight:bold; font-family:monospace; text-transform:uppercase;">${sv.sku}</div>
            </div>
          `;
        });
      });
    });

    printWindow.document.write(`
      <html>
        <head>
          <title>Bulk Print Barcodes</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background: #fff; text-align:center; }
            .grid { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
            @media print {
              body { background: white; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:5px; font-weight:bold;">
              Print Barcode Labels
            </button>
            <p style="font-size:12px; color:#666;">Confirm print preview settings and margin layout configuration.</p>
          </div>
          <div class="grid">${cardsHtml}</div>
        </body>
      </html>
    `);

    printWindow.document.close();
    addToast("Bulk barcode sheets successfully compiled.", "success");
  };

  // Individual barcode printing inside the modal
  const handlePrintIndividualBarcode = (product: Product, cv: ColorVariant, sv: SubVariant) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Popup blocker prevented printing.", "error");
      return;
    }

    const barValue = sv.barcode || sv.sku || "FX0000";

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Label - ${sv.sku}</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 90vh; font-family: sans-serif; background:#fff; }
            .card { text-align: center; width: 220px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <div style="text-align:center;">
            <button onclick="window.print()" style="padding: 8px 16px; margin-bottom: 20px; cursor: pointer; background: #10b981; color: white; border: none; border-radius: 4px; font-weight: bold;">
              Print Barcode
            </button>
            <div class="card">
              <div style="display:flex; justify-content:center; margin-bottom:4px;">
                ${getBarcodeSvgString(barValue, 0.8, 24)}
              </div>
              <div style="font-size:10px; font-weight:bold; font-family:monospace; text-transform:uppercase;">${sv.sku}</div>
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    addToast("Individual barcode window compiled.", "success");
  };

  const triggerPrintBarcodes = () => {
    if (!barcodePrintProduct) return;
    
    // Create print-only layout inside a new window
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      addToast("Popup blocker prevented printing. Please enable popups.", "error");
      return;
    }

    const titleText = barcodePrintProduct.title;
    const cardsHtml = barcodePrintProduct.colorVariants.flatMap(cv => 
      cv.subVariants?.map(sv => {
        const barValue = sv.barcode || sv.sku || "FX0000";
        
        return `
          <div style="text-align:center; width:140px; margin:10px; display:inline-block;">
            <div style="display:flex; justify-content:center; margin-bottom:4px;">
              ${getBarcodeSvgString(barValue, 0.8, 24)}
            </div>
            <div style="font-size:10px; font-weight:bold; font-family:monospace; text-transform:uppercase;">${sv.sku}</div>
          </div>
        `;
      }) || []
    ).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcode Labels - ${titleText}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; background: #fff; text-align:center; }
            .grid { display: flex; flex-wrap: wrap; gap: 15px; justify-content: center; }
            @media print {
              body { background: white; padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align:center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor:pointer; background:#10b981; color:white; border:none; border-radius:5px; font-weight:bold;">
              Print Barcode Sheet
            </button>
            <p style="font-size:12px; color:#666; margin-top:5px;">Ensure margins are disabled and background graphics are printed.</p>
          </div>
          <div class="grid">${cardsHtml}</div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    addToast("Barcode printable layout generated.", "success");
  };

  // Find category name by ID
  const getCategoryName = (catId: string) => {
    const cat = activeCategories.find(c => c._id === catId);
    return cat ? cat.name : catId;
  };

  const isAllPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProductIds.includes(p._id));

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground mt-1">Manage B2B inventory lines, custom MOQ, and SEO tags.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" /> Bulk Operations
          </Button>
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
            <QrCode className="h-4 w-4 mr-2" /> Scan Barcode / Audit
          </Button>
          <Link href="/admin/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Setting for Default Highlight Price */}
      {globalHighlightPrice && (
        <Card className="border border-border/80 p-4 bg-secondary/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1">
                Global Highlight Price Setting
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Change the default price tier displayed to guest users on the public storefront. Updates all product highlights instantly.
              </p>
            </div>
            <div className="flex flex-col space-y-1.5 min-w-[240px]">
              <label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-0.5">
                Default Highlight Price <span className="text-destructive">*</span>
              </label>
              <select
                value={globalHighlightPrice}
                onChange={(e) => handleGlobalHighlightPriceChange(e.target.value as any)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="B2C">B2C Price (Selling Price)</option>
                <option value="B2B">B2B Price (Trade Price)</option>
                <option value="Dropshipping">Dropshipping Price</option>
              </select>
            </div>
          </div>
        </Card>
      )}

      {/* Panel Tab Switcher */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActivePanel("catalog")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            activePanel === "catalog" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Product Catalog List
        </button>
        <button
          onClick={() => setActivePanel("inventory")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
            activePanel === "inventory" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Warehouse Inventory & Ledger (10/10)
        </button>
      </div>

      {activePanel === "catalog" ? (
        <>


      {/* Advanced Filters & Sorting Bar */}
      <ProductFilters
        searchTerm={searchTerm} setSearchTerm={setSearchTerm}
        selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
        selectedHsn={selectedHsn} setSelectedHsn={setSelectedHsn}
        selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
        selectedStockStatus={selectedStockStatus} setSelectedStockStatus={setSelectedStockStatus}
        sortBy={sortBy} setSortBy={setSortBy}
        activeCategories={activeCategories} hsns={hsns}
      />

      {/* Table Card */}
      <ProductTable
        isAllPageSelected={isAllPageSelected}
        handleSelectAllOnPage={handleSelectAllOnPage}
        processedProducts={processedProducts}
        paginatedProducts={paginatedProducts}
        selectedProductIds={selectedProductIds}
        handleSelectRow={handleSelectRow}
        getCategoryName={getCategoryName}
        toggleProductActive={toggleProductActive}
        handleDeleteProduct={handleDeleteProduct}
        setBarcodePrintProduct={setBarcodePrintProduct}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        ITEMS_PER_PAGE={ITEMS_PER_PAGE}
      />
        </>
      ) : (
        <InventoryManager />
      )}

      {/* Barcode print modal dialogue */}
      {barcodePrintProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full border-border max-h-[85vh] flex flex-col">
            <CardHeader className="border-b">
              <CardTitle className="text-lg flex justify-between items-center">
                <span>Print Barcodes - {barcodePrintProduct.title}</span>
                <Button variant="ghost" size="sm" onClick={() => setBarcodePrintProduct(null)}>Close</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
              <p className="text-xs text-muted-foreground">
                Select whether to print individual labels or generate a print sheet for all variants.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {barcodePrintProduct.colorVariants?.flatMap((cv) => 
                  cv.subVariants?.map((sv, idx) => (
                    <div key={`${cv.color}-${sv.id}-${idx}`} className="p-4 border rounded-lg bg-secondary/20 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-primary">{cv.color} ({sv.size} / {sv.weight})</span>
                      <Barcode sku={sv.barcode || sv.sku} height={35} />
                      <span className="text-[10px] text-muted-foreground font-mono">SKU: {sv.sku}</span>
                      
                      {/* Individual download option */}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePrintIndividualBarcode(barcodePrintProduct, cv, sv)}
                        className="text-xs mt-2 w-full flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Barcode
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setBarcodePrintProduct(null)}>Cancel</Button>
                <Button onClick={triggerPrintBarcodes} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5">
                  <Download className="h-4 w-4" /> Download All Barcodes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Barcode scanner modal */}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />

      {/* Bulk Operations Modal */}
      <BulkOperationsModal
        isOpen={isBulkOpen}
        onClose={() => setIsBulkOpen(false)}
        products={activeProducts}
        categories={activeCategories}
        hsns={hsns}
        selectedProductIds={selectedProductIds}
        onImportSuccess={async () => {
          // Force refetch products from backend to update state
          await initializeProducts(undefined, true);
          setSelectedProductIds([]);
        }}
        onBulkDelete={handleBulkDelete}
        onBulkPrintBarcodes={handleBulkDownloadBarcodes}
      />
    </div>
  );
}
