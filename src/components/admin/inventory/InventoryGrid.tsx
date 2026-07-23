"use client";

import * as React from "react";
import { Search, Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CardContent } from "@/components/ui/Card";
import { useInventory } from "./InventoryContext";

export function InventoryGrid() {
  const {
    searchTerm,
    setSearchTerm,
    stockFilter,
    setStockFilter,
    paginatedVariants,
    filteredVariants,
    adjustments,
    setAdjustments,
    handleQuickAdjust,
    gridPage,
    setGridPage,
    gridPageSize,
    totalGridPages
  } = useInventory();

  return (
    <div className="border border-border shadow-sm bg-card rounded-xl text-foreground">
      <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKU, Product, or Color..."
            className="pl-9 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "low", "out"] as const).map((filter) => (
            <Button
              key={filter}
              variant={stockFilter === filter ? "default" : "outline"}
              size="sm"
              className="capitalize font-bold cursor-pointer"
              onClick={() => setStockFilter(filter)}
            >
              {filter === "all" ? "All Stocks" : filter === "low" ? "Low Stock (<15)" : "Out of Stock"}
            </Button>
          ))}
        </div>
      </div>
      
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-secondary/40 font-bold text-muted-foreground uppercase text-[10px] border-b">
            <tr>
              <th className="px-6 py-3">Product Name</th>
              <th className="px-6 py-3">SKU Code</th>
              <th className="px-6 py-3">Color</th>
              <th className="px-6 py-3">Size/Weight</th>
              <th className="px-6 py-3 text-center">Current Stock</th>
              <th className="px-6 py-3 text-right">Quick Stock Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedVariants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground italic">
                  No active cargo lines match filters.
                </td>
              </tr>
            ) : (
              paginatedVariants.map((item) => {
                const sku = item.sku;
                const stock = item.stock;
                const inputVal = adjustments[sku] || "";
                const isLowStock = stock > 0 && stock < 15;
                const isOutStock = stock === 0;

                return (
                  <tr key={item.product._id + "-" + item.subVariant.id} className="hover:bg-secondary/15 transition-colors text-foreground">
                    <td className="px-6 py-4 font-bold max-w-xs truncate" title={item.product.title}>
                      {item.product.title}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-muted-foreground">{sku}</td>
                    <td className="px-6 py-4 font-medium">{item.colorVariant.color}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {item.subVariant.size || "—"} / {item.subVariant.weight || "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {isOutStock ? (
                        <span className="bg-destructive/10 text-destructive font-black px-2 py-0.5 rounded shadow-sm text-[10px]">
                          OUT OF STOCK
                        </span>
                      ) : isLowStock ? (
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded shadow-sm">
                          {stock} units (Low)
                        </span>
                      ) : (
                        <span className="font-bold text-success font-mono">{stock} units</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          className="w-14 h-8 text-center text-xs p-1"
                          value={inputVal}
                          onChange={(e) => setAdjustments(prev => ({ ...prev, [sku]: e.target.value }))}
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-success hover:bg-success/15 cursor-pointer"
                          title="Add Stock (+)"
                          onClick={() => handleQuickAdjust(sku, stock, item, "add")}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/15 cursor-pointer"
                          title="Deduct Stock (-)"
                          disabled={stock === 0}
                          onClick={() => handleQuickAdjust(sku, stock, item, "sub")}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-8 px-2 text-[10px] font-bold cursor-pointer"
                          title="Override Absolute Stock (=)"
                          onClick={() => handleQuickAdjust(sku, stock, item, "set")}
                        >
                          Set
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
      
      {/* Pagination Controls */}
      {totalGridPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-border/60 bg-secondary/5 gap-4">
          <span className="text-xs text-muted-foreground font-medium">
            Showing {(gridPage - 1) * gridPageSize + 1} to {Math.min(filteredVariants.length, gridPage * gridPageSize)} of {filteredVariants.length} lines
          </span>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-bold text-xs h-8 px-3 cursor-pointer"
              disabled={gridPage === 1}
              onClick={() => setGridPage(Math.max(1, gridPage - 1))}
            >
              Previous
            </Button>
            <span className="text-xs font-semibold px-2">
              Page {gridPage} of {totalGridPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="font-bold text-xs h-8 px-3 cursor-pointer"
              disabled={gridPage === totalGridPages}
              onClick={() => setGridPage(Math.min(totalGridPages, gridPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
