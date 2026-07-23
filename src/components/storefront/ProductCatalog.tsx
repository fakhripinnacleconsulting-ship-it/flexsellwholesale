"use client";

import * as React from "react";
import Link from "next/link";
import { Product, Category } from "@/types";
import { resolvePrice } from "@/lib/priceTierHelper";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { Input } from "@/components/ui/Input";
import {
  ShoppingCart,
  Heart,
  Grid,
  List,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Minus,
  Plus,
  ShieldCheck,
  Info,
  ChevronDown
} from "lucide-react";
import { useProductStore } from "@/stores/productStore";
import { useCategoryStore } from "@/stores/categoryStore";
import Image from "next/image";
import { Pagination } from "@/components/ui/Pagination";
import { formatPrice } from "@/lib/utils";
import { usePathname, useSearchParams } from "next/navigation";
import { ProductCard } from "./ProductCard";
import { ExportCatalogButton } from "./ExportCatalogButton";

interface ProductCatalogProps {
  initialProducts: Product[];
  initialCategories: Category[];
}

export function ProductCatalog({ initialProducts, initialCategories }: ProductCatalogProps) {
  const { products, initializeProducts } = useProductStore();
  const { categories, initializeCategories } = useCategoryStore();

  // Layout States
  const [sortBy, setSortBy] = React.useState("recommended");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 12;

  // Filter States
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [minPrice, setMinPrice] = React.useState<number | "">("");
  const [maxPrice, setMaxPrice] = React.useState<number | "">("");
  const [inStockOnly, setInStockOnly] = React.useState(false);
  const [minDiscount, setMinDiscount] = React.useState<number>(0);
  const [showMobileFilters, setShowMobileFilters] = React.useState(false);

  // Bulk item quantities selection
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

  // Sync server products and categories into client stores
  React.useEffect(() => {
    initializeProducts(initialProducts);
    initializeCategories(initialCategories);
  }, [initialProducts, initialCategories, initializeProducts, initializeCategories]);

  const activeProducts = products.length > 0 ? products : initialProducts;

  // Reset to page 1 on filter or sorting change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, selectedCategories, minPrice, maxPrice, inStockOnly, minDiscount]);

  // Toggle category checkboxes
  const handleCategoryToggle = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  // Clear all sidebar filters
  const handleClearFilters = () => {
    setSelectedCategories([]);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    setMinDiscount(0);
  };

  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Load initial filters from URL search params on mount
  React.useEffect(() => {
    if (!searchParams) return;
    const catParam = searchParams.get("categories") || searchParams.get("category");
    if (catParam) {
      setSelectedCategories(catParam.split(",").filter(Boolean));
    }
    const minP = searchParams.get("minPrice");
    if (minP) setMinPrice(Number(minP));

    const maxP = searchParams.get("maxPrice");
    if (maxP) setMaxPrice(Number(maxP));

    const inStock = searchParams.get("inStock");
    if (inStock === "true") setInStockOnly(true);

    const minDisc = searchParams.get("minDiscount");
    if (minDisc) setMinDiscount(Number(minDisc));

    const sortP = searchParams.get("sort");
    if (sortP) setSortBy(sortP);
  }, [searchParams]);

  // Sync filter changes dynamically to browser URL search params
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();

    if (selectedCategories.length > 0) {
      params.set("categories", selectedCategories.join(","));
    }
    if (minPrice !== "") params.set("minPrice", String(minPrice));
    if (maxPrice !== "") params.set("maxPrice", String(maxPrice));
    if (inStockOnly) params.set("inStock", "true");
    if (minDiscount > 0) params.set("minDiscount", String(minDiscount));
    if (sortBy && sortBy !== "recommended") params.set("sort", sortBy);

    const queryString = params.toString();
    const newUrl = queryString ? `${pathname}?${queryString}` : pathname;

    window.history.replaceState(null, "", newUrl);
  }, [selectedCategories, minPrice, maxPrice, inStockOnly, minDiscount, sortBy, pathname]);

  // Category hierarchy matching: include selected categories and all their subcategories
  const matchingCategoryIds = React.useMemo(() => {
    if (selectedCategories.length === 0) return new Set<string>();

    const activeCats = categories.length > 0 ? categories : initialCategories;
    const ids = new Set<string>();

    selectedCategories.forEach((catIdOrSlug) => {
      const cat = activeCats.find(
        (c) => c._id === catIdOrSlug || c.slug === catIdOrSlug || c.name.toLowerCase() === catIdOrSlug.toLowerCase()
      );
      if (cat) {
        ids.add(cat._id);
        // Include subcategories under this parent category
        activeCats.filter((c) => c.parentId === cat._id).forEach((sub) => {
          ids.add(sub._id);
          activeCats.filter((c2) => c2.parentId === sub._id).forEach((sub2) => ids.add(sub2._id));
        });
      } else {
        ids.add(catIdOrSlug);
      }
    });

    return ids;
  }, [selectedCategories, categories, initialCategories]);

  // Filter Logic
  const filteredProducts = React.useMemo(() => {
    let list = [...activeProducts];

    if (matchingCategoryIds.size > 0) {
      list = list.filter(p => matchingCategoryIds.has(p.categoryId));
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
  }, [activeProducts, matchingCategoryIds, minPrice, maxPrice, inStockOnly, minDiscount]);

  // Sorting logic
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
    return list; // recommended/default
  }, [filteredProducts, sortBy]);

  const totalPages = Math.ceil(sortedProducts.length / ITEMS_PER_PAGE);

  const paginatedProducts = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [sortedProducts, currentPage]);


  // Get active parent categories for filter checklist
  const parentCategories = React.useMemo(() => {
    return categories.filter(c => !c.parentId);
  }, [categories]);

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-8 text-foreground w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 border-b pb-6 border-border/60">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Wholesale Hub</h1>
          <p className="text-muted-foreground mt-1">Industrial B2B cargo directly sourced from verified factory partners.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Mobile Filter toggle */}
          <Button
            variant="outline"
            className="lg:hidden flex-1 sm:flex-none flex items-center justify-center gap-2"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filters
          </Button>

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
            onChange={(e) => setSortBy(e.target.value)}
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
        {/* Left Column: Sidebar Filters (collapsible on mobile) */}
        <div className={`w-full lg:w-64 flex-shrink-0 bg-card rounded-xl border border-border p-5 space-y-6 text-foreground h-fit lg:sticky lg:top-24 transition-all duration-300 ${showMobileFilters ? "block" : "hidden lg:block"
          }`}>
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Filter Products
            </h3>
            <button
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-medium"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>

          {/* Categories checklist */}
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

          {/* Price Range */}
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Price Range (₹)</h4>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                placeholder="Min"
                className="h-8 text-xs text-center"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value === "" ? "" : Number(e.target.value))}
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="number"
                placeholder="Max"
                className="h-8 text-xs text-center"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
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
                onChange={(e) => setInStockOnly(e.target.checked)}
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
                    onChange={() => setMinDiscount(disc)}
                    className="text-primary focus:ring-primary w-4 h-4 bg-background"
                  />
                  <span>{disc === 0 ? "All Offers" : `${disc}% OFF & higher`}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Catalog Grid/List & Pagination */}
        <div className="flex-1 w-full space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-muted-foreground bg-card p-3 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <p className="font-medium">Showing <span className="text-foreground font-bold">{sortedProducts.length}</span> wholesale products</p>
              {selectedCategories.length > 0 && <span className="text-primary font-semibold text-[11px] bg-primary/10 px-2 py-0.5 rounded border border-primary/20">Filters active</span>}
            </div>
            <ExportCatalogButton 
              products={sortedProducts} 
              categories={initialCategories} 
              catalogTitle="Wholesale Product Catalog" 
              filterSummary={selectedCategories.length > 0 ? "Category Filtered" : "All Products"}
            />
          </div>

          {sortedProducts.length === 0 ? (
            <div className="text-center py-20 bg-secondary/10 rounded-xl border border-dashed flex flex-col items-center justify-center">
              <Info className="h-8 w-8 text-muted-foreground/60 mb-3 animate-pulse" />
              <p className="font-bold text-foreground text-base">No Product found</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">Try adjusting price bounds, checking parent categories, or resetting active filters.</p>
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
