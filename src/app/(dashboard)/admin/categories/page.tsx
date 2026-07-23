import * as React from "react";
import { categoryService } from "@/services/categoryService";
import { AdminCategoriesManager } from "@/components/admin/AdminCategoriesManager";

export default async function AdminCategoriesPage() {
  const categories = await categoryService.getCategories();
  return <AdminCategoriesManager initialCategories={categories} />;
}
