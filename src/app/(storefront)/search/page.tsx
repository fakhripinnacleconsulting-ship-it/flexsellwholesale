import * as React from "react";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { SearchResults } from "@/components/storefront/SearchResults";

export default async function SearchResultsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = q || "";
  const products = await productService.getProducts();
  const categories = await categoryService.getCategories();
  
  return <SearchResults query={query} initialProducts={products} initialCategories={categories} />;
}
