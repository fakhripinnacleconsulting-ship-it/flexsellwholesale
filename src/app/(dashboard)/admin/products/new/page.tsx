import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { AdminProductForm } from "@/components/admin/AdminProductForm";

export default async function AdminNewProductPage() {
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  return <AdminProductForm initialProducts={products} initialCategories={categories} />;
}
