import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { ProductCatalog } from "@/components/storefront/ProductCatalog";

export const revalidate = 60;

export default async function ProductsPage() {
  let products: any[] = [];
  let categories: any[] = [];
  try {
    products = await productService.getProducts();
    categories = await categoryService.getCategories();
  } catch (err) {
    console.error("ProductsPage DB fetch notice:", (err as any)?.message || err);
  }
  return <ProductCatalog initialProducts={products} initialCategories={categories} />;
}
