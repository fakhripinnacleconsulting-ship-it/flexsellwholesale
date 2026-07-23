"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Tag, ArrowRight, Loader2, Sparkles, Box } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";
import { searchService, SuggestResult } from "@/services/searchService";
import { motion, AnimatePresence } from "framer-motion";

interface GlobalSearchInputProps {
  placeholder?: string;
  className?: string;
  onSearchSubmitted?: () => void;
  isMobile?: boolean;
}

export function GlobalSearchInput({
  placeholder = "Search products, SKUs, categories...",
  className = "",
  onSearchSubmitted,
  isMobile = false,
}: GlobalSearchInputProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<SuggestResult>({
    products: [],
    skus: [],
    categories: [],
  });
  const [selectedIndex, setSelectedIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceTimer = React.useRef<NodeJS.Timeout | null>(null);

  // Debounced Auto-Suggest Fetching
  React.useEffect(() => {
    if (!query.trim()) {
      setSuggestions({ products: [], skus: [], categories: [] });
      setLoading(false);
      return;
    }

    setLoading(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await searchService.suggest(query, 5);
        setSuggestions(res);
      } catch (err) {
        console.error("Auto-suggest error:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // Click Outside Listener
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalItems =
    suggestions.skus.length + suggestions.products.length + suggestions.categories.length;

  // Keyboard Navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < totalItems ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalItems - 1));
    } else if (e.key === "Escape") {
      setIsFocused(false);
    } else if (e.key === "Enter") {
      if (selectedIndex >= 0 && selectedIndex < totalItems) {
        e.preventDefault();
        // Index mapping logic
        let count = 0;
        if (selectedIndex < suggestions.skus.length) {
          const item = suggestions.skus[selectedIndex];
          router.push(`/products/${item.slug}`);
          setIsFocused(false);
          if (onSearchSubmitted) onSearchSubmitted();
          return;
        }
        count += suggestions.skus.length;

        if (selectedIndex - count < suggestions.products.length) {
          const item = suggestions.products[selectedIndex - count];
          router.push(`/products/${item.slug}`);
          setIsFocused(false);
          if (onSearchSubmitted) onSearchSubmitted();
          return;
        }
        count += suggestions.products.length;

        if (selectedIndex - count < suggestions.categories.length) {
          const item = suggestions.categories[selectedIndex - count];
          router.push(`/categories/${item.slug}`);
          setIsFocused(false);
          if (onSearchSubmitted) onSearchSubmitted();
          return;
        }
      } else if (query.trim()) {
        e.preventDefault();
        router.push(`/products?search=${encodeURIComponent(query.trim())}`);
        setIsFocused(false);
        if (onSearchSubmitted) onSearchSubmitted();
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsFocused(false);
      if (onSearchSubmitted) onSearchSubmitted();
    }
  };

  const showDropdown =
    isFocused &&
    query.trim().length > 0 &&
    (loading || suggestions.products.length > 0 || suggestions.skus.length > 0 || suggestions.categories.length > 0);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleFormSubmit} className="relative w-full">
        <Input
          type="search"
          placeholder={placeholder}
          className={`w-full ${isMobile ? "h-10 pl-9 pr-10 text-xs" : "h-10 pl-4 pr-10 rounded-full"} border border-input bg-muted/40 text-sm text-foreground transition-all duration-300 ${
            isFocused ? "bg-background ring-2 ring-primary border-primary shadow-sm" : "focus:bg-background"
          }`}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Search className="h-4 w-4 text-foreground" />
          )}
        </button>
      </form>

      {/* Auto-Suggest Dropdown Popup */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-xl backdrop-blur-md"
          >
            <div className="max-h-96 overflow-y-auto p-2 text-popover-foreground space-y-3">
              {/* SKUs Direct Match */}
              {suggestions.skus.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-primary" /> Matching SKUs
                  </div>
                  <div className="mt-1 space-y-1">
                    {suggestions.skus.map((skuItem, idx) => {
                      const isSelected = selectedIndex === idx;
                      return (
                        <Link
                          key={skuItem.sku}
                          href={`/products/${skuItem.slug}`}
                          onClick={() => {
                            setIsFocused(false);
                            if (onSearchSubmitted) onSearchSubmitted();
                          }}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                            isSelected ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="bg-primary/10 text-primary font-mono px-2 py-0.5 rounded font-bold border border-primary/20">
                              {skuItem.sku}
                            </span>
                            <span className="truncate text-muted-foreground">{skuItem.productTitle}</span>
                            <span className="text-[10px] text-muted-foreground">({skuItem.color})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{formatPrice(skuItem.price)}</span>
                            {skuItem.stock > 0 ? (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-1.5 py-0.5 rounded">
                                In Stock
                              </span>
                            ) : (
                              <span className="text-[10px] bg-destructive/10 text-destructive font-bold px-1.5 py-0.5 rounded">
                                Out of Stock
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Products Match */}
              {suggestions.products.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Box className="h-3 w-3 text-primary" /> Products
                  </div>
                  <div className="mt-1 space-y-1">
                    {suggestions.products.map((prod, idx) => {
                      const itemIdx = suggestions.skus.length + idx;
                      const isSelected = selectedIndex === itemIdx;
                      const rawImg = typeof prod.image === "string" ? prod.image : (prod.image as any)?.url || "";
                      const validImgSrc = rawImg && rawImg.trim() ? rawImg.trim() : "/placeholder.png";

                      return (
                        <Link
                          key={prod._id}
                          href={`/products/${prod.slug}`}
                          onClick={() => {
                            setIsFocused(false);
                            if (onSearchSubmitted) onSearchSubmitted();
                          }}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                            isSelected ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent/50"
                          }`}
                        >
                          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                            <Image
                              src={validImgSrc}
                              alt={prod.title}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-foreground truncate">{prod.title}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              {prod.categoryName && <span>{prod.categoryName}</span>}
                              {prod.matchedSku && (
                                <span className="font-mono text-primary font-bold">
                                  SKU: {prod.matchedSku}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="font-bold text-foreground">{formatPrice(prod.price)}</div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Category Suggestions */}
              {suggestions.categories.length > 0 && (
                <div className="border-t pt-2">
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-primary" /> Categories
                  </div>
                  <div className="mt-1 space-y-1">
                    {suggestions.categories.map((cat, idx) => {
                      const itemIdx = suggestions.skus.length + suggestions.products.length + idx;
                      const isSelected = selectedIndex === itemIdx;
                      return (
                        <Link
                          key={cat._id}
                          href={`/categories/${cat.slug}`}
                          onClick={() => {
                            setIsFocused(false);
                            if (onSearchSubmitted) onSearchSubmitted();
                          }}
                          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            isSelected ? "bg-accent text-accent-foreground font-semibold" : "hover:bg-accent/50"
                          }`}
                        >
                          <span className="font-medium text-foreground">{cat.name}</span>
                          <span className="text-[11px] text-muted-foreground">{cat.count} items</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View All Search Results Footer */}
              <div className="border-t pt-2 px-2 pb-1">
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  className="w-full py-2 px-3 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  View all results for &quot;{query}&quot; <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
