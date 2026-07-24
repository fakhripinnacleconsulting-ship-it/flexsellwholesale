import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { ProductCatalog } from "@/components/storefront/ProductCatalog";

export const revalidate = 60;

export default async function ProductsPage() {
  let products: any[] = [];
  let categories: any[] = [];
  try {
    const [productsData, categoriesData] = await Promise.all([
      productService.getProducts(),
      categoryService.getCategories()
    ]);
    products = productsData;
    categories = categoriesData;
  } catch (err) {
    console.error("ProductsPage DB fetch notice:", (err as any)?.message || err);
  }
  return <ProductCatalog initialProducts={products} initialCategories={categories} />;
}
