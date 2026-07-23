"use client";

import * as React from "react";
import { Badge } from "@/components/ui/Badge";
import { useProductDetail } from "./ProductDetailContext";
import { Star } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export function AddToCartPanel() {
  const {
    product,
    activeVariant,
    activeSubVariant
  } = useProductDetail();

  if (!product) return null;

  const visibility = product.fieldVisibility || {
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  };

  const gstRate = product.gstRate ?? 18;
  const isIncl = product.priceIncludesGst ?? true;
  
  const { useAuthStore } = require("@/stores/authStore");
  const customer = useAuthStore((state: any) => state.customer);
  const { resolvePrice } = require("@/lib/priceTierHelper");

  let activeTier: "B2C" | "B2B" | "Dropshipping" = product.defaultPriceTier || "B2C";
  if (customer && customer.customerTypes && customer.customerTypes.length > 0) {
    if (customer.customerTypes.includes("B2C")) activeTier = "B2C";
    else if (customer.customerTypes.includes("B2B")) activeTier = "B2B";
    else activeTier = "Dropshipping";
  }

  const highlightPrice = activeSubVariant ? resolvePrice(activeSubVariant, activeTier) : 0;
  const b2cPrice = activeSubVariant ? activeSubVariant.b2cPrice : 0;
  const b2bPrice = activeSubVariant ? activeSubVariant.b2bPrice : 0;
  const dropshippingPrice = activeSubVariant ? activeSubVariant.dropshippingPrice : 0;
  const mrp = activeSubVariant ? activeSubVariant.mrp : 0;
  const b2bMoq = activeSubVariant ? (activeSubVariant.b2bMoq || 1) : 1;

  let taxAmount = 0;
  let totalPrice = highlightPrice;

  if (isIncl) {
    taxAmount = highlightPrice - (highlightPrice / (1 + gstRate / 100));
  } else {
    taxAmount = highlightPrice * (gstRate / 100);
    totalPrice = highlightPrice + taxAmount;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          <Badge variant="secondary" className="font-semibold">FACTORY DIRECT SUPPLY</Badge>
          {activeSubVariant && (
            <Badge variant="outline" className="border-primary text-primary font-mono text-[10px]">
              SKU: {activeSubVariant.sku}
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-black tracking-tight">{product.title}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
            <span className="text-sm font-black">{product.rating || "0.0"}</span>
            <span className="text-xs text-muted-foreground">({product.reviewCount || "0"} verified reviews)</span>
          </div>
        </div>
      </div>

      {activeSubVariant && (
        <div className="p-4 bg-secondary/15 rounded-xl border border-border/40 space-y-4">
          <div className="flex items-baseline justify-between border-b border-border/40 pb-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary">{formatPrice(totalPrice)}</span>
              {mrp > highlightPrice && (
                <span className="text-sm text-muted-foreground line-through font-medium">{formatPrice(mrp)}</span>
              )}
              <span className="text-xs text-muted-foreground font-bold">
                {isIncl ? "(GST Inclusive)" : "(GST Exclusive)"}
              </span>
            </div>
          </div>

          {/* Comparative Price Tiers Grid (Indian Standards) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-secondary/10 p-3 rounded-lg text-xs border">
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block">MRP</span>
              <span className="font-semibold text-foreground">{formatPrice(mrp)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-emerald-600 dark:text-emerald-400">Selling Price (B2C)</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(b2cPrice)}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-blue-600 dark:text-blue-400">Trade Price (B2B)</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {b2bPrice > 0 ? formatPrice(b2bPrice) : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase block text-purple-600 dark:text-purple-400">Dropship Price</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {dropshippingPrice > 0 ? formatPrice(dropshippingPrice) : "N/A"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
            {(activeSubVariant?.stock || 0) > b2bMoq * 2 ? (
              <Badge variant="success">In Stock ({activeSubVariant?.stock || 0} available)</Badge>
            ) : (activeSubVariant?.stock || 0) > 0 ? (
              <Badge variant="warning">Low Stock ({activeSubVariant?.stock || 0} remaining)</Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
            
            {activeTier === "B2B" && (
              <span className="text-muted-foreground font-semibold">• Minimum Order: {b2bMoq} units</span>
            )}
            
            {visibility.showDimensions && activeVariant?.dimensions && (
              <span className="text-muted-foreground font-semibold">• Box Size: {activeVariant.dimensions}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
