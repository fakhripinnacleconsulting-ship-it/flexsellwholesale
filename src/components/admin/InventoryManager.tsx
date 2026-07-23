"use client";

import * as React from "react";
import { Download, Upload, Grid, History } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { InventoryProvider, useInventory } from "./inventory/InventoryContext";
import { InventoryGrid } from "./inventory/InventoryGrid";
import { InventoryLedger } from "./inventory/InventoryLedger";
import { CSVImportDialog } from "./inventory/CSVImportDialog";

function InventoryManagerInner() {
  const {
    activeTab,
    setActiveTab,
    handleExportCSV,
    handleImportCSV
  } = useInventory();

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Operations */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 border border-border rounded-xl shadow-sm text-foreground">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Warehouse Inventory Audit & Adjustment</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Perform physical stock takes, export stock sheets, or upload bulk logistics sheets.
          </p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleExportCSV} 
            className="flex-1 md:flex-none font-bold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export Stock Sheet
          </Button>

          <label className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/95 border rounded-md cursor-pointer text-xs font-bold shadow-sm transition-colors">
            <Upload className="h-3.5 w-3.5" /> Import Stock Update
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleImportCSV} 
              className="hidden" 
            />
          </label>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border text-foreground">
        <button
          onClick={() => setActiveTab("grid")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "grid" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Grid className="h-4 w-4" /> Stock Adjustment Grid
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === "ledger" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" /> Stock Adjustment Ledger
        </button>
      </div>

      {/* TAB CONTENT: STOCK GRID */}
      {activeTab === "grid" && <InventoryGrid />}

      {/* TAB CONTENT: STOCK LEDGER LOGS */}
      {activeTab === "ledger" && <InventoryLedger />}

      {/* CSV IMPORT RESULTS MODAL DIALOG */}
      <CSVImportDialog />
    </div>
  );
}

export function InventoryManager() {
  return (
    <InventoryProvider>
      <InventoryManagerInner />
    </InventoryProvider>
  );
}
