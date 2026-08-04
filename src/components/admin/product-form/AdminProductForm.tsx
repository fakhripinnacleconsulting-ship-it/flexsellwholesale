"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Product, Category } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { ProductFormProvider, useProductForm } from "./ProductFormContext";
import { BasicInfoCard } from "./BasicInfoCard";
import { TaxComplianceCard } from "./TaxComplianceCard";

import { FieldVisibilityCard } from "./FieldVisibilityCard";
import { VariantEditor } from "./VariantEditor";
import { SEOCard } from "./SEOCard";
import { APlusContentCard } from "./APlusContentCard";

interface AdminProductFormProps {
  productId?: string;
  initialProducts: Product[];
  initialCategories: Category[];
}

function ProductFormInner() {
  const { existingProduct, handleSave, isSaving } = useProductForm();
  const pathname = usePathname();
  const basePath = pathname.startsWith("/manager") ? "/manager/catalog" : "/admin";
  const { hasPermission } = usePermissions();
  const canSave = existingProduct ? hasPermission("catalog_products", "update") : hasPermission("catalog_products", "create");

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Link href={`${basePath}/products`}>
          <Button variant="outline" size="icon" className="h-9 w-9 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {existingProduct ? "Edit Product" : "Add New Product"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {existingProduct ? `Modify B2B catalogue parameters for ${existingProduct.title}` : "Publish new inventory item"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <BasicInfoCard />
        <TaxComplianceCard />

        <FieldVisibilityCard />
        <VariantEditor />
        <SEOCard />
        <APlusContentCard />

        {/* Sticky Save Bar at the bottom of the screen */}
        <div className="sticky -bottom-10 -mx-4 sm:-mx-6 md:-mx-8 p-3 sm:p-4 bg-background/95 backdrop-blur-md border-t border-border flex flex-wrap sm:flex-nowrap justify-between sm:justify-end items-center gap-3 z-30 shadow-xl">
          <Link href={`${basePath}/products`} className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto h-10 text-sm font-semibold cursor-pointer" disabled={isSaving}>
              Cancel
            </Button>
          </Link>
          {existingProduct ? (
            <Button type="submit" size="lg" className="w-full sm:w-auto h-10 text-sm font-bold cursor-pointer" disabled={isSaving || !canSave}>
              {isSaving ? "Saving..." : "Save Product Details"}
            </Button>
          ) : (
            <Button type="submit" size="lg" className="w-full sm:w-auto h-10 text-sm font-bold cursor-pointer" disabled={isSaving || !canSave}>
              {isSaving ? "Publishing..." : "Publish Product"}
            </Button>
          )}
        </div>

        {/* Spacer to prevent the fixed bar from covering the last card content */}
        <div className="h-16" />
      </form>
    </div>
  );
}

export function AdminProductForm({ productId, initialProducts, initialCategories }: AdminProductFormProps) {
  return (
    <ProductFormProvider
      productId={productId}
      initialProducts={initialProducts}
      initialCategories={initialCategories}
    >
      <ProductFormInner />
    </ProductFormProvider>
  );
}
