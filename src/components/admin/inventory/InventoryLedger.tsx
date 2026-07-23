"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { useInventory } from "./InventoryContext";
import { useInventoryHistoryStore } from "@/stores/inventoryHistoryStore";

export function InventoryLedger() {
  const { clearLogs, isLoading: ledgerLoading } = useInventoryHistoryStore();
  const {
    ledgerSearch,
    setLedgerSearch,
    ledgerActionFilter,
    setLedgerActionFilter,
    paginatedLogs,
    filteredLogs,
    ledgerPage,
    setLedgerPage,
    ledgerPageSize,
    totalLedgerPages
  } = useInventory();

  return (
    <div className="border border-border shadow-sm bg-card rounded-xl text-foreground">
      <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search Product, SKU, or Details..."
            className="pl-9 h-10"
            value={ledgerSearch}
            onChange={(e) => setLedgerSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            className="h-9 px-3 rounded-md border border-border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary"
            value={ledgerActionFilter}
            onChange={(e) => setLedgerActionFilter(e.target.value)}
          >
            <option value="all">All Operations</option>
            <option value="Manual Adjustment">Manual Adjustments</option>
            <option value="CSV Bulk Import">CSV Bulk Imports</option>
            <option value="Scan Adjustment">Scanner Adjustments</option>
            <option value="Order Deduction">Order Sales Deductions</option>
          </select>
          <Button variant="outline" size="sm" onClick={clearLogs} className="font-bold text-destructive border-destructive/20 hover:bg-destructive/10 h-9 cursor-pointer">
            Clear Logs
          </Button>
        </div>
      </div>
      
      <CardContent className="p-0 overflow-x-auto">
        {ledgerLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading ledger events...</span>
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 font-bold text-muted-foreground uppercase text-[10px] border-b">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Product / Variant</th>
                <th className="px-6 py-3 font-mono">SKU</th>
                <th className="px-6 py-3">Action Type</th>
                <th className="px-6 py-3 text-center">Previous Stock</th>
                <th className="px-6 py-3 text-center">Adjustment</th>
                <th className="px-6 py-3 text-center">Resulting Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground italic">
                    No stock ledger events recorded yet.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const isPositive = log.change > 0;
                  const changeStr = isPositive ? `+${log.change}` : `${log.change}`;

                  return (
                    <tr key={log._id} className="hover:bg-secondary/15 transition-colors text-foreground">
                      <td className="px-6 py-4 text-muted-foreground font-mono whitespace-nowrap">{log.timestamp}</td>
                      <td className="px-6 py-4">
                        <span className="font-bold">{log.productName}</span>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                          {log.variantDetails}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-muted-foreground">{log.sku}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          log.actionType === "CSV Bulk Import" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" :
                          log.actionType === "Scan Adjustment" ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" :
                          log.actionType === "Order Deduction" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                        }`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-medium">{log.prevStock}</td>
                      <td className="px-6 py-4 text-center font-mono font-bold">
                        <span className={isPositive ? "text-success" : "text-destructive"}>
                          {changeStr}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold">{log.newStock}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </CardContent>

      {/* Pagination Controls */}
      {totalLedgerPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-border/60 bg-secondary/5 gap-4">
          <span className="text-xs text-muted-foreground font-medium">
            Showing {(ledgerPage - 1) * ledgerPageSize + 1} to {Math.min(filteredLogs.length, ledgerPage * ledgerPageSize)} of {filteredLogs.length} events
          </span>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-bold text-xs h-8 px-3 cursor-pointer"
              disabled={ledgerPage === 1}
              onClick={() => setLedgerPage(Math.max(1, ledgerPage - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-semibold px-2">
              Page {ledgerPage} of {totalLedgerPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="font-bold text-xs h-8 px-3 cursor-pointer"
              disabled={ledgerPage === totalLedgerPages}
              onClick={() => setLedgerPage(Math.min(totalLedgerPages, ledgerPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
