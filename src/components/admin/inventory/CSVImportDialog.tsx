"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useInventory } from "./InventoryContext";

export function CSVImportDialog() {
  const { importResults, setImportResults } = useInventory();

  if (!importResults || !importResults.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card text-card-foreground border border-border w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-secondary/15">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-lg">CSV Stock Import Summary</h3>
          </div>
          <button 
            onClick={() => setImportResults(null)}
            className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-5 text-sm leading-relaxed">
          {/* Summary Alerts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Successful Updates</span>
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {importResults.successCount}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Stock levels modified successfully.</p>
            </div>
            <div className="p-4 rounded-lg bg-zinc-500/10 border border-zinc-500/20">
              <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider block">Skipped (No Change)</span>
              <span className="text-3xl font-black text-zinc-600 dark:text-zinc-400 mt-1 block">
                {importResults.skippedCount}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Stock matches current levels.</p>
            </div>
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">Errors / Warnings</span>
              <span className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1 block">
                {importResults.errors.length}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Lines that could not be processed.</p>
            </div>
          </div>

          {/* Informative Alert for New Products */}
          {importResults.errors.some(e => e.reason === "SKU Not Found") && (
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/25 flex gap-3 text-xs">
              <AlertTriangle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-blue-700 dark:text-blue-400 block">Sourcing New Inventory?</span>
                <p className="text-muted-foreground leading-normal">
                  Stock adjustments can only be applied to **existing** catalog SKUs. If you are importing new inventory lines or new variations (different colors, sizes, or weights), you must add them first.
                </p>
                <div className="flex gap-4 pt-1.5 font-bold">
                  <Link href="/admin/products/new" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    Add New Product <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link href="/admin/products" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    Manage Existing Products <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Error Details Log */}
          {importResults.errors.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase text-muted-foreground tracking-wider">Detailed Error Logs</h4>
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-secondary/40 font-bold text-muted-foreground border-b uppercase text-[9px]">
                      <tr>
                        <th className="px-4 py-2 text-center w-12">Line</th>
                        <th className="px-4 py-2 w-28">SKU</th>
                        <th className="px-4 py-2 w-32">Error Type</th>
                        <th className="px-4 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {importResults.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-secondary/5">
                          <td className="px-4 py-2.5 text-center font-mono font-medium text-muted-foreground">{err.line}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-foreground">{err.sku}</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                              err.reason === "SKU Not Found" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" :
                              err.reason === "Invalid Stock Value" ? "bg-red-100 text-red-800 dark:bg-red-955/40 dark:text-red-400" :
                              "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {err.reason}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground leading-normal">
                            {err.detail}
                            {err.reason === "SKU Not Found" && (
                              <Link 
                                href="/admin/products/new" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline font-bold inline-flex items-center gap-0.5 ml-1"
                              >
                                Add product/variant <ArrowRight className="h-2.5 w-2.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end bg-secondary/15">
          <Button 
            onClick={() => setImportResults(null)}
            className="font-bold text-xs h-9 cursor-pointer"
          >
            Close Summary
          </Button>
        </div>
      </div>
    </div>
  );
}
