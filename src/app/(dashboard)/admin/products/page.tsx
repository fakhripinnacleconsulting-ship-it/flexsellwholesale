import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { AdminProductsManager } from "@/components/admin/AdminProductsManager";

export default async function AdminProductsPage() {
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  return <AdminProductsManager initialProducts={products} initialCategories={categories} />;
}
