"use client";

import * as React from "react";
import Link from "next/link";
import { Product, Category } from "@/types";
import { resolvePrice } from "@/lib/priceTierHelper";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import {
  ShoppingCart,
  SearchX,
  Heart,
  Grid,
  List,
  SlidersHorizontal,
  RotateCcw,
  Minus,
  Plus,
  Info
} from "lucide-react";
import { useProductStore } from "@/stores/productStore";
import { useCategoryStore } from "@/stores/categoryStore";
import Image from "next/image";
import { Pagination } from "@/components/ui/Pagination";
import { formatPrice } from "@/lib/utils";
import { ProductCard } from "./ProductCard";

interface SearchResultsProps {
  query: string;
  initialProducts: Product[];
  initialCategories: Category[];
}

export function SearchResults({ query, initialProducts, initialCategories }: SearchResultsProps) {
  const { products, initializeProducts } = useProductStore();
  const { categories, initializeCategories } = useCategoryStore();

  // Layout States
  const [sortBy, setSortBy] = React.useState("recommended");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 12;

  // Track query prop change and reset page index during render
  const [prevQuery, setPrevQuery] = React.useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setCurrentPage(1);
  }

  // Filter States
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [minPrice, setMinPrice] = React.useState<number | "">("");
  const [maxPrice, setMaxPrice] = React.useState<number | "">("");
  const [inStockOnly, setInStockOnly] = React.useState(false);
  const [minDiscount, setMinDiscount] = React.useState<number>(0);
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Bulk quantities select
  const [quantities, setQuantities] = React.useState<Record<string, number>>({});

  const getItemQty = (id: string) => quantities[id] || 1;
  const adjustItemQty = (id: string, amount: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + amount)
    }));
  };
  const setItemQty = (id: string, qty: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(1, qty)
    }));
  };

  React.useEffect(() => {
    initializeProducts(initialProducts);
    initializeCategories(initialCategories);
  }, [initialProducts, initialCategories, initializeProducts, initializeCategories]);

  const activeProducts = products.length > 0 ? products : initialProducts;
  const lowercaseQuery = query.toLowerCase();

  // Exact SKU Match Detection
  const exactSkuMatch = React.useMemo(() => {
    if (!lowercaseQuery) return null;
    for (const p of activeProducts) {
      if (p.colorVariants) {
        for (const cv of p.colorVariants) {
          if (cv.subVariants) {
            for (const sv of cv.subVariants) {
              if (sv.sku && sv.sku.toLowerCase() === lowercaseQuery) {
                return {
                  product: p,
                  sku: sv.sku,
                  variantDetails: `${cv.color} • ${sv.size || "Standard"} • ${sv.weight || "250g"}`,
                };
              }
            }
          }
        }
      }
    }
    return null;
  }, [activeProducts, lowercaseQuery]);

  // Search Results base match list with SKU priority sorting
  const results = React.useMemo(() => {
    if (!lowercaseQuery) return activeProducts;

    const listWithScore = activeProducts
      .map((p) => {
        let score = 0;
        let matchedBySku = false;

        // 1. Exact Product ID match (+100)
        if (p._id.toLowerCase() === lowercaseQuery) score += 100;

        // 2. SKU and Barcode match (+95 exact, +70 partial)
        p.colorVariants?.forEach((cv) => {
          cv.subVariants?.forEach((sv) => {
            const skuLower = (sv.sku || "").toLowerCase();
            const barcodeLower = (sv.barcode || "").toLowerCase();
            if (skuLower === lowercaseQuery || barcodeLower === lowercaseQuery) {
              score += 95;
              matchedBySku = true;
            } else if (skuLower.startsWith(lowercaseQuery)) {
              score += 70;
              matchedBySku = true;
            } else if (skuLower.includes(lowercaseQuery) || barcodeLower.includes(lowercaseQuery)) {
              score += 50;
              matchedBySku = true;
            }
          });
        });

        // 3. Title match (+60 exact, +40 start, +25 includes)
        const titleLower = p.title.toLowerCase();
        if (titleLower === lowercaseQuery) score += 60;
        else if (titleLower.startsWith(lowercaseQuery)) score += 40;
        else if (titleLower.includes(lowercaseQuery)) score += 25;

        // 4. Category Name match (+30)
        const category = categories.find((c) => c._id === p.categoryId);
        if (category && category.name.toLowerCase().includes(lowercaseQuery)) score += 30;

        // 5. Tags & HSN Code (+20)
        if (p.hsnCode && p.hsnCode.toLowerCase().includes(lowercaseQuery)) score += 20;
        if (p.tags?.some((t) => t.toLowerCase().includes(lowercaseQuery))) score += 20;
        if ((p.description || "").toLowerCase().includes(lowercaseQuery)) score += 10;

        return { product: p, score, matchedBySku };
      })
      .filter((item) => item.score > 0);

    listWithScore.sort((a, b) => b.score - a.score);
    return listWithScore.map((item) => item.product);
  }, [activeProducts, lowercaseQuery, categories]);

  const handleCategoryToggle = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setMinDiscount(0);
    setCurrentPage(1);
  };

  // Filter Logic
  const filteredProducts = React.useMemo(() => {
    let list = [...results];

    if (selectedCategories.length > 0) {
      list = list.filter(p => selectedCategories.includes(p.categoryId));
    }
    if (minPrice !== "") {
      list = list.filter(p => {
        const sv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = sv ? resolvePrice(sv, p.defaultPriceTier || "B2C") : 0;
        return price >= Number(minPrice);
      });
    }
    if (maxPrice !== "") {
      list = list.filter(p => {
        const sv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = sv ? resolvePrice(sv, p.defaultPriceTier || "B2C") : 0;
        return price <= Number(maxPrice);
      });
    }
    if (inStockOnly) {
      list = list.filter(p => p.totalStock > 0);
    }
    if (minDiscount > 0) {
      list = list.filter(p => {
        const sv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = sv ? resolvePrice(sv, p.defaultPriceTier || "B2C") : 0;
        const mrp = sv?.mrp ?? 0;
        const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
        return discount >= minDiscount;
      });
    }

    return list;
  }, [results, selectedCategories, minPrice, maxPrice, inStockOnly, minDiscount]);

  // Sort products
  const sortedProducts = React.useMemo(() => {
    const list = [...filteredProducts];
    if (sortBy === "price-asc") {
      return list.sort((a, b) => {
        const svA = a.colorVariants?.[0]?.subVariants?.[0];
        const priceA = svA ? resolvePrice(svA, a.defaultPriceTier || "B2C") : 0;
        const svB = b.colorVariants?.[0]?.subVariants?.[0];
        const priceB = svB ? resolvePrice(svB, b.defaultPriceTier || "B2C") : 0;
        return priceA - priceB;
      });
    }
    if (sortBy === "price-desc") {
      return list.sort((a, b) => {
        const svA = a.colorVariants?.[0]?.subVariants?.[0];
        const priceA = svA ? resolvePrice(svA, a.defaultPriceTier || "B2C") : 0;
        const svB = b.colorVariants?.[0]?.subVariants?.[0];
        const priceB = svB ? resolvePrice(svB, b.defaultPriceTier || "B2C") : 0;
        return priceB - priceA;
      });
    }
    if (sortBy === "newest") {
      return list.sort((a, b) => new Date(b.createdAt || "").getTime() - new Date(a.createdAt || "").getTime());
    }
    return list;
  }, [filteredProducts, sortBy]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);

  const paginatedProducts = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedProducts, currentPage]);


  const parentCategories = React.useMemo(() => {
    return categories.filter(c => !c.parentId);
  }, [categories]);

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-8 text-foreground w-full">
      {/* Exact SKU Match Banner */}
      {exactSkuMatch && (
        <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs uppercase font-mono">
              SKU
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-primary">Exact SKU Match Found</div>
              <div className="text-sm font-semibold text-foreground">
                <span className="font-mono bg-background px-2 py-0.5 rounded border border-border mr-2 font-bold">{exactSkuMatch.sku}</span>
                {exactSkuMatch.product.title} ({exactSkuMatch.variantDetails})
              </div>
            </div>
          </div>
          <Link href={`/products/${exactSkuMatch.product.slug}`}>
            <Button size="sm" className="font-bold">View Product &rarr;</Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b pb-6 border-border/60">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Search Results</h1>
          <p className="text-muted-foreground mt-1">Showing cargo matches for query: <span className="font-semibold text-primary">&quot;{query}&quot;</span></p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Mobile Filter toggle */}
          {results.length > 0 && (
            <Button
              variant="outline"
              className="lg:hidden flex-1 sm:flex-none flex items-center justify-center gap-2"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
            >
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </Button>
          )}

          {/* Grid/List togglers */}
          <div className="hidden sm:flex border rounded-md p-0.5 bg-secondary/20">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Grid View"
            >
              <Grid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="border-input border rounded-md px-3 py-2 text-sm bg-background text-foreground flex-1 sm:flex-none h-10"
          >
            <option value="recommended">Sort by: Recommended</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Newest Arrivals</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Column: Sidebar Filters */}
        <div className={`w-full lg:w-64 flex-shrink-0 bg-card rounded-xl border border-border p-5 space-y-6 text-foreground h-fit lg:sticky lg:top-24 transition-all duration-300 ${showMobileFilters ? "block" : "hidden lg:block"
          }`}>
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Filter
            </h3>
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>

          {/* Categories checklist */}
          {parentCategories.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Categories</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {parentCategories.map(cat => {
                  const checked = selectedCategories.includes(cat._id);
                  return (
                    <label key={cat._id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleCategoryToggle(cat._id)}
                        className="rounded border-input text-primary focus:ring-primary w-4 h-4 bg-background"
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Range */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Price Range (₹)</h4>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min"
                className="h-8 text-xs text-center"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value === "" ? "" : Number(e.target.value)); setCurrentPage(1); }}
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="number"
                placeholder="Max"
                className="h-8 text-xs text-center"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value === "" ? "" : Number(e.target.value)); setCurrentPage(1); }}
              />
            </div>
          </div>

          {/* Stock toggle */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Availability</h4>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => { setInStockOnly(e.target.checked); setCurrentPage(1); }}
                className="rounded border-input text-primary focus:ring-primary w-4 h-4 bg-background"
              />
              <span>In Stock Only</span>
            </label>
          </div>

          {/* Discount levels */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Wholesale Discount</h4>
            <div className="space-y-2">
              {[0, 20, 40, 60].map((disc) => (
                <label key={disc} className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                  <input
                    type="radio"
                    name="minDiscount"
                    checked={minDiscount === disc}
                    onChange={() => { setMinDiscount(disc); setCurrentPage(1); }}
                    className="text-primary focus:ring-primary w-4 h-4 bg-background"
                  />
                  <span>{disc === 0 ? "All Offers" : `${disc}% OFF & higher`}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Search Results Grid/List */}
        <div className="flex-1 w-full space-y-6">
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <p>Showing {sortedProducts.length} cargo matches for query</p>
          </div>

          {sortedProducts.length === 0 ? (
            <div className="text-center py-20 bg-secondary/25 rounded-xl border border-dashed flex flex-col items-center justify-center">
              <SearchX className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse" />
              <p className="font-bold text-foreground text-base">No matches found</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">We couldn&apos;t find any products matching your search criteria or active filters.</p>
              <Button size="sm" onClick={handleClearFilters} className="mt-4">Reset Filters</Button>
            </div>
          ) : viewMode === "grid" ? (
            /* Enhanced B2B Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product._id} product={product} layout="grid" />
              ))}
            </div>
          ) : (
            /* Enhanced B2B List View */
            <div className="space-y-4">
              {paginatedProducts.map((product) => (
                <ProductCard key={product._id} product={product} layout="list" />
              ))}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={sortedProducts.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </div>
    </div>
  );
}
