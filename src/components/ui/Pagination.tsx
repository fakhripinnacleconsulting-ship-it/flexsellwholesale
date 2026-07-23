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
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 mt-6 border-t border-border/60">
      <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        Showing <span className="font-semibold text-foreground">{startItem}</span> to{" "}
        <span className="font-semibold text-foreground">{endItem}</span> of{" "}
        <span className="font-semibold text-foreground">{totalItems}</span> entries
      </p>
      
      <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
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
              className="h-8 w-8 text-xs p-0 font-medium"
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
          className="h-8 w-8"
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
