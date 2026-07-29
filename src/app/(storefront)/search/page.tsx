import type { Metadata } from "next";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { SearchResults } from "@/components/storefront/SearchResults";
import { constructMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  const query = q || "";
  if (!query) {
    return constructMetadata({ title: "Product Search", path: "/search", noIndex: true });
  }
  return constructMetadata({
    title: `Search results for "${query}"`,
    description: `Find wholesale catalog items, kitchen tools, and household utilities matching "${query}".`,
    path: `/search?q=${encodeURIComponent(query)}`,
  });
}

export default async function SearchResultsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q || "";
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  
  return <SearchResults query={query} initialProducts={products} initialCategories={categories} />;
}
