import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { AdminProductsManager } from "@/components/admin/AdminProductsManager";

export const dynamic = "force-dynamic";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerProductsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["catalog_products"]}>
      <ManagerProductsPage {...props} />
    </PermissionGuard>
  );
}

async function ManagerProductsPage() {
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  return <AdminProductsManager initialProducts={products} initialCategories={categories} />;
}
