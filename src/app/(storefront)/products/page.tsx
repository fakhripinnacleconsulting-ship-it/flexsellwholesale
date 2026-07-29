import { Metadata } from "next";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { ProductCatalog } from "@/components/storefront/ProductCatalog";
import { constructMetadata } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "All Wholesale Products & Factory Direct Catalog",
    description: "Browse thousands of household utilities, kitchen tools, gadgets, and fast-moving consumer goods at factory direct wholesale prices.",
    keywords: ["wholesale catalog", "wholesail products", "bulk buying India", "kichen gadgets wholesale", "household products direct importer"],
    path: "/products",
  });
}

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
