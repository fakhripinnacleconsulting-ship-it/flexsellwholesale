import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { AdminProductForm } from "@/components/admin/AdminProductForm";

export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  return <AdminProductForm productId={id} initialProducts={products} initialCategories={categories} />;
}
