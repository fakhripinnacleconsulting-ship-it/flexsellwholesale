"use client";

import * as React from "react";
import { Product, Category } from "@/types";
import { Button } from "@/components/ui/Button";
import { Printer, FileText } from "lucide-react";
import { B2BCatalogPrintModal } from "./B2BCatalogPrintModal";

interface ExportCatalogButtonProps {
  products: Product[];
  categories?: Category[];
  catalogTitle?: string;
  filterSummary?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ExportCatalogButton({
  products,
  categories = [],
  catalogTitle = "Wholesale Product Catalog",
  filterSummary,
  variant = "outline",
  size = "sm",
  className = "",
}: ExportCatalogButtonProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsModalOpen(true)}
        disabled={products.length === 0}
        className={`gap-2 font-medium border-border hover:border-primary transition-colors ${className}`}
        title="Export or print structured B2B product catalog"
      >
        <Printer className="h-4 w-4 text-primary" />
        <span>Export Catalog</span>
      </Button>

      <B2BCatalogPrintModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        products={products}
        categories={categories}
        catalogTitle={catalogTitle}
        filterSummary={filterSummary}
      />
    </>
  );
}
