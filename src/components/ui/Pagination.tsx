"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  itemsPerPageOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
}: PaginationProps) {
  if (totalPages <= 1 && (!onItemsPerPageChange || totalItems <= itemsPerPageOptions[0])) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-2 mt-0 border-t border-border bg-card">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
          Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
          <span className="font-semibold text-foreground">{endItem}</span> of{" "}
          <span className="font-semibold text-foreground">{totalItems}</span> entries
        </p>
        
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground uppercase font-semibold">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="h-6 rounded-md border border-input bg-background px-1 py-0 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-6 w-6 p-0"
          type="button"
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>

        {pages.map((p) => {
          // If we have too many pages, render a subset (simple truncation logic)
          if (totalPages > 6) {
            const isNearStart = currentPage <= 3;
            const isNearEnd = currentPage >= totalPages - 2;
            
            if (isNearStart && p > 4 && p < totalPages) {
              if (p === 5) return <span key={p} className="px-1 text-muted-foreground text-xs">...</span>;
              return null;
            }
            if (isNearEnd && p > 1 && p < totalPages - 3) {
              if (p === totalPages - 4) return <span key={p} className="px-1 text-muted-foreground text-xs">...</span>;
              return null;
            }
            if (!isNearStart && !isNearEnd) {
              if (p > 1 && p < currentPage - 1) {
                if (p === 2) return <span key={p} className="px-1 text-muted-foreground text-xs">...</span>;
                return null;
              }
              if (p > currentPage + 1 && p < totalPages) {
                if (p === currentPage + 2) return <span key={p} className="px-1 text-muted-foreground text-xs">...</span>;
                return null;
              }
            }
          }

          return (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(p)}
              className="h-6 w-6 text-[11px] p-0 font-bold"
              type="button"
            >
              {p}
            </Button>
          );
        })}

        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-6 w-6 p-0"
          type="button"
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
