import * as React from "react";
import { categoryService } from "@/services/categoryService";
import { AdminCategoriesManager } from "@/components/admin/AdminCategoriesManager";

export const dynamic = "force-dynamic";

export default async function ManagerCategoriesPage() {
  const categories = await categoryService.getCategories();
  return <AdminCategoriesManager initialCategories={categories} />;
}
