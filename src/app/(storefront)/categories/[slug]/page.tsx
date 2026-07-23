import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { CategoryCatalog } from "@/components/storefront/CategoryCatalog";

export const revalidate = 3600;

export default async function CategoryProductsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  
  return <CategoryCatalog slug={slug} initialProducts={products} initialCategories={categories} />;
}
