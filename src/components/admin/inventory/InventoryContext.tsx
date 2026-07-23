"use client";

import * as React from "react";
import { Product, ColorVariant, SubVariant } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { useInventoryHistoryStore } from "@/stores/inventoryHistoryStore";
import { useToastStore } from "@/stores/toastStore";

interface FlattenedVariant {
  product: Product;
  colorVariant: ColorVariant;
  subVariant: SubVariant;
  sku: string;
  stock: number;
}

interface InventoryContextProps {
  activeTab: "grid" | "ledger";
  setActiveTab: (t: "grid" | "ledger") => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  stockFilter: "all" | "low" | "out";
  setStockFilter: (f: "all" | "low" | "out") => void;
  ledgerSearch: string;
  setLedgerSearch: (s: string) => void;
  ledgerActionFilter: string;
  setLedgerActionFilter: (f: string) => void;
  adjustments: Record<string, string>;
  setAdjustments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  gridPage: number;
  setGridPage: (p: number) => void;
  gridPageSize: number;
  ledgerPage: number;
  setLedgerPage: (p: number) => void;
  ledgerPageSize: number;
  importResults: {
    isOpen: boolean;
    successCount: number;
    skippedCount: number;
    errors: Array<{
      line: number;
      sku: string;
      reason: "SKU Not Found" | "Invalid Stock Value" | "Parsing Error";
      detail: string;
    }>;
  } | null;
  setImportResults: (r: any) => void;
  flattenedVariants: FlattenedVariant[];
  filteredVariants: FlattenedVariant[];
  totalGridPages: number;
  paginatedVariants: FlattenedVariant[];
  filteredLogs: any[];
  totalLedgerPages: number;
  paginatedLogs: any[];
  handleQuickAdjust: (sku: string, currentStock: number, item: FlattenedVariant, action: "add" | "sub" | "set") => Promise<void>;
  saveStockUpdate: (item: FlattenedVariant, newStock: number, change: number, actionType: "Scan Adjustment" | "CSV Bulk Import" | "Order Deduction" | "Manual Adjustment") => Promise<void>;
  handleExportCSV: () => void;
  handleImportCSV: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InventoryContext = React.createContext<InventoryContextProps | undefined>(undefined);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { products, updateProduct } = useProductStore();
  const { logs, addLog, initializeLogs } = useInventoryHistoryStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = React.useState<"grid" | "ledger">("grid");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [stockFilter, setStockFilter] = React.useState<"all" | "low" | "out">("all");
  
  const [ledgerSearch, setLedgerSearch] = React.useState("");
  const [ledgerActionFilter, setLedgerActionFilter] = React.useState("all");

  const [adjustments, setAdjustments] = React.useState<Record<string, string>>({});

  const [gridPage, setGridPage] = React.useState(1);
  const gridPageSize = 10;

  const [ledgerPage, setLedgerPage] = React.useState(1);
  const ledgerPageSize = 10;

  const [importResults, setImportResults] = React.useState<any | null>(null);

  React.useEffect(() => {
    initializeLogs();
  }, [initializeLogs]);

  React.useEffect(() => {
    setGridPage(1);
  }, [searchTerm, stockFilter]);

  React.useEffect(() => {
    setLedgerPage(1);
  }, [ledgerSearch, ledgerActionFilter]);

  const flattenedVariants = React.useMemo(() => {
    const list: FlattenedVariant[] = [];
    products.forEach((product) => {
      product.colorVariants?.forEach((cv) => {
        cv.subVariants?.forEach((sv) => {
          list.push({
            product,
            colorVariant: cv,
            subVariant: sv,
            sku: sv.sku,
            stock: sv.stock,
          });
        });
      });
    });
    return list;
  }, [products]);

  const filteredVariants = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return stockFilter === "all"
        ? flattenedVariants
        : flattenedVariants.filter((item) =>
            stockFilter === "low" ? item.stock > 0 && item.stock < 15 : item.stock === 0
          );
    }

    return flattenedVariants.filter((item) => {
      const matchesSearch =
        item.sku.toLowerCase().includes(term) ||
        (item.subVariant.barcode || "").toLowerCase().includes(term) ||
        item.product.title.toLowerCase().includes(term) ||
        item.product._id.toLowerCase() === term ||
        (item.product.hsnCode || "").toLowerCase().includes(term) ||
        item.colorVariant.color.toLowerCase().includes(term) ||
        (item.subVariant.size || "").toLowerCase().includes(term) ||
        (item.subVariant.weight || "").toLowerCase().includes(term);

      const matchesStock =
        stockFilter === "all"
          ? true
          : stockFilter === "low"
          ? item.stock > 0 && item.stock < 15
          : item.stock === 0;

      return matchesSearch && matchesStock;
    });
  }, [flattenedVariants, searchTerm, stockFilter]);

  const totalGridPages = Math.ceil(filteredVariants.length / gridPageSize) || 1;
  const paginatedVariants = React.useMemo(() => {
    const startIndex = (gridPage - 1) * gridPageSize;
    return filteredVariants.slice(startIndex, startIndex + gridPageSize);
  }, [filteredVariants, gridPage]);

  const filteredLogs = React.useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch = 
        log.productName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        log.sku.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        log.variantDetails.toLowerCase().includes(ledgerSearch.toLowerCase());

      const matchesAction = 
        ledgerActionFilter === "all" ? true :
        log.actionType === ledgerActionFilter;

      return matchesSearch && matchesAction;
    });
  }, [logs, ledgerSearch, ledgerActionFilter]);

  const totalLedgerPages = Math.ceil(filteredLogs.length / ledgerPageSize) || 1;
  const paginatedLogs = React.useMemo(() => {
    const startIndex = (ledgerPage - 1) * ledgerPageSize;
    return filteredLogs.slice(startIndex, startIndex + ledgerPageSize);
  }, [filteredLogs, ledgerPage]);

  const saveStockUpdate = async (
    item: FlattenedVariant, 
    newStock: number, 
    change: number, 
    actionType: "Scan Adjustment" | "CSV Bulk Import" | "Order Deduction" | "Manual Adjustment"
  ) => {
    const { product, colorVariant, subVariant } = item;
    
    const updatedVariants = product.colorVariants.map((cv) => {
      if (cv.color === colorVariant.color) {
        const updatedSubs = cv.subVariants.map((sv) => 
          sv.id === subVariant.id ? { ...sv, stock: newStock } : sv
        );
        return { ...cv, subVariants: updatedSubs };
      }
      return cv;
    });

    const totalStock = updatedVariants.reduce((sum, cv) => 
      sum + (cv.subVariants?.filter(sv => sv.isActive !== false).reduce((sSum, sv) => sSum + sv.stock, 0) || 0)
    , 0);

    const updatedProduct = {
      ...product,
      totalStock,
      colorVariants: updatedVariants
    };

    await updateProduct(product._id, updatedProduct);

    const variantDetails = `${colorVariant.color} • ${subVariant.size || "Standard"} • ${subVariant.weight || "250g"}`;
    await addLog({
      sku: subVariant.sku,
      productName: product.title,
      variantDetails,
      actionType,
      change,
      prevStock: subVariant.stock,
      newStock
    });

    addToast(`Stock for SKU ${subVariant.sku} updated successfully.`, "success");
  };

  const handleQuickAdjust = async (sku: string, currentStock: number, item: FlattenedVariant, action: "add" | "sub" | "set") => {
    const inputVal = adjustments[sku] || "";
    const parsed = parseInt(inputVal, 10);
    
    if (isNaN(parsed) || parsed <= 0) {
      addToast("Please input a valid quantity.", "warning");
      return;
    }

    let change = 0;
    let newStock = currentStock;

    if (action === "add") {
      change = parsed;
      newStock = currentStock + parsed;
    } else if (action === "sub") {
      change = -parsed;
      newStock = Math.max(0, currentStock - parsed);
    } else if (action === "set") {
      change = parsed - currentStock;
      newStock = parsed;
    }

    await saveStockUpdate(item, newStock, change, "Manual Adjustment");
    
    setAdjustments(prev => {
      const copy = { ...prev };
      delete copy[sku];
      return copy;
    });
  };

  const handleExportCSV = () => {
    const headers = ["SKU", "Product Name", "Color", "Size", "Weight", "Current Stock"];
    const rows = flattenedVariants.map((v) => [
      v.sku,
      v.product.title,
      v.colorVariant.color,
      v.subVariant.size || "Standard",
      v.subVariant.weight || "250g",
      v.subVariant.stock.toString()
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `flexsell_inventory_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Inventory CSV file downloaded successfully.", "success");
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      let successCount = 0;
      let skippedCount = 0;
      const errorsList: Array<{
        line: number;
        sku: string;
        reason: "SKU Not Found" | "Invalid Stock Value" | "Parsing Error";
        detail: string;
      }> = [];

      if (lines.length <= 1) {
        addToast("The uploaded CSV file is empty.", "error");
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
        
        if (matches.length < 6) {
          errorsList.push({
            line: i + 1,
            sku: matches[0]?.replace(/"/g, "").trim() || "Unknown",
            reason: "Parsing Error",
            detail: `Line contains only ${matches.length} columns (expected at least 6).`
          });
          continue;
        }

        const sku = matches[0].replace(/"/g, "").trim();
        const stockStr = matches[5].replace(/"/g, "").trim();
        const targetStock = parseInt(stockStr, 10);

        if (isNaN(targetStock) || targetStock < 0) {
          errorsList.push({
            line: i + 1,
            sku,
            reason: "Invalid Stock Value",
            detail: `Stock value '${stockStr}' must be a positive integer.`
          });
          continue;
        }

        const matchItem = flattenedVariants.find(item => item.sku.toLowerCase() === sku.toLowerCase());
        if (matchItem) {
          const change = targetStock - matchItem.stock;
          if (change !== 0) {
            await saveStockUpdate(matchItem, targetStock, change, "CSV Bulk Import");
            successCount++;
          } else {
            skippedCount++;
          }
        } else {
          errorsList.push({
            line: i + 1,
            sku,
            reason: "SKU Not Found",
            detail: `SKU '${sku}' not found. Only existing stocks can be adjusted by this sheet.`
          });
        }
      }

      setImportResults({
        isOpen: true,
        successCount,
        skippedCount,
        errors: errorsList
      });

      e.target.value = "";
    };
    reader.readAsText(file);
  };

  return (
    <InventoryContext.Provider value={{
      activeTab,
      setActiveTab,
      searchTerm,
      setSearchTerm,
      stockFilter,
      setStockFilter,
      ledgerSearch,
      setLedgerSearch,
      ledgerActionFilter,
      setLedgerActionFilter,
      adjustments,
      setAdjustments,
      gridPage,
      setGridPage,
      gridPageSize,
      ledgerPage,
      setLedgerPage,
      ledgerPageSize,
      importResults,
      setImportResults,
      flattenedVariants,
      filteredVariants,
      totalGridPages,
      paginatedVariants,
      filteredLogs,
      totalLedgerPages,
      paginatedLogs,
      handleQuickAdjust,
      saveStockUpdate,
      handleExportCSV,
      handleImportCSV
    }}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = React.useContext(InventoryContext);
  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }
  return context;
}
export type { FlattenedVariant };
