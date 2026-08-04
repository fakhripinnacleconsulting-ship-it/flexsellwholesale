import * as React from "react";
import { categoryService } from "@/services/categoryService";
import { AdminCategoriesManager } from "@/components/admin/AdminCategoriesManager";

export const dynamic = "force-dynamic";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerCategoriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["catalog_categories"]}>
      <ManagerCategoriesPage {...props} />
    </PermissionGuard>
  );
}

async function ManagerCategoriesPage() {
  const categories = await categoryService.getCategories();
  return <AdminCategoriesManager initialCategories={categories} />;
}
