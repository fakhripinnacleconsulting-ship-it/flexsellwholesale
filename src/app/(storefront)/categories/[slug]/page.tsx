import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { CategoryCatalog } from "@/components/storefront/CategoryCatalog";

export const revalidate = 60;

export default async function CategoryProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [products, categories] = await Promise.all([
    productService.getProducts(),
    categoryService.getCategories()
  ]);
  
  return <CategoryCatalog slug={slug} initialProducts={products} initialCategories={categories} />;
}
