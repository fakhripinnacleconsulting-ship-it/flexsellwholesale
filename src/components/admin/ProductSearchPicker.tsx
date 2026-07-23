"use client";

import * as React from "react";
import Image from "next/image";
import { Search, Check, X, Tag, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { formatPrice } from "@/lib/utils";
import { searchService } from "@/services/searchService";
import { resolvePrice } from "@/lib/priceTierHelper";

interface ProductSearchPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product, selectedSku?: string) => void;
  selectedProductIds?: string[];
  title?: string;
  multiSelect?: boolean;
}

export function ProductSearchPicker({
  isOpen,
  onClose,
  onSelectProduct,
  selectedProductIds = [],
  title = "Select Product by SKU or Name",
  multiSelect = false,
}: ProductSearchPickerProps) {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [exactSku, setExactSku] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const fetchProducts = async () => {
      setLoading(true);
      try {
        const result = await searchService.searchProducts({
          query: searchTerm.trim(),
          limit: 30,
        });
        setProducts(result.products);
        setExactSku(result.exactSkuMatch?.sku || null);
      } catch (err) {
        console.error("Failed to search products in picker:", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchProducts, 200);
    return () => clearTimeout(timer);
  }, [isOpen, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-foreground">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-lg">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border bg-muted/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by SKU (e.g. TSH-BLK), product ID, or name..."
              className="pl-9 h-11 text-sm bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
            )}
          </div>
        </div>

        {/* Product List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {products.length === 0 && !loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No products found matching &quot;{searchTerm}&quot;. Try searching by exact SKU or title.
            </div>
          ) : (
            products.map((p) => {
              const isSelected = selectedProductIds.includes(p._id);
              const firstCv = p.colorVariants?.[0];
              const firstSv = firstCv?.subVariants?.[0];
              const price = firstSv ? resolvePrice(firstSv, p.defaultPriceTier || "B2C") : 0;
              const firstImg = firstCv?.images?.[0];
              const rawImg = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || "";
              const validImgSrc = rawImg && rawImg.trim() ? rawImg.trim() : "/placeholder.png";

              // Gather all variant SKUs for badges
              const skus: string[] = [];
              p.colorVariants?.forEach((cv) => {
                cv.subVariants?.forEach((sv) => {
                  if (sv.sku) skus.push(sv.sku);
                });
              });

              return (
                <div
                  key={p._id}
                  onClick={() => {
                    onSelectProduct(p, exactSku || skus[0]);
                    if (!multiSelect) onClose();
                  }}
                  className={`flex items-start gap-4 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border hover:border-primary/50 hover:bg-accent/40"
                  }`}
                >
                  <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted">
                    <Image src={validImgSrc} alt={p.title} fill className="object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-foreground truncate">{p.title}</span>
                      <span className="font-extrabold text-sm text-primary">{formatPrice(price)}</span>
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>ID: {p._id}</span>
                      <span>•</span>
                      <span>Stock: {p.totalStock}</span>
                    </div>

                    {/* SKU Badges */}
                    {skus.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        {skus.slice(0, 4).map((sku) => (
                          <span
                            key={sku}
                            className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                              sku.toLowerCase() === searchTerm.trim().toLowerCase()
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {sku}
                          </span>
                        ))}
                        {skus.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{skus.length - 4} more</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center self-center">
                    <div
                      className={`h-6 w-6 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-input bg-background"
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
