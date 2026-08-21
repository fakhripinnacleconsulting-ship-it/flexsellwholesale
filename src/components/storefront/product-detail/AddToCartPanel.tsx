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
  const { resolvePrice, resolveCustomerTier } = require("@/lib/priceTierHelper");

  const activeTier = customer && customer.customerTypes && customer.customerTypes.length > 0
    ? resolveCustomerTier(customer.customerTypes)
    : (product.defaultPriceTier || "B2C");

  const highlightPrice = activeSubVariant ? resolvePrice(activeSubVariant, activeTier) : 0;
  const b2cPrice = activeSubVariant ? activeSubVariant.b2cPrice : 0;
  const b2bPrice = activeSubVariant ? activeSubVariant.b2bPrice : 0;
  const dropshippingPrice = activeSubVariant ? activeSubVariant.dropshippingPrice : 0;
  const mrp = activeSubVariant ? activeSubVariant.mrp : 0;
  const b2bMoq = activeSubVariant ? (activeSubVariant.b2bMoq || 1) : 1;

  /**
   * Whether this viewer can actually buy at the wholesale rate.
   *
   * A minimum order quantity is a B2B term, so it is only worth showing to someone B2B
   * pricing is available to. `isPureB2B` matches the rule `resolveMoq` now enforces, so the
   * badge and the cart cannot disagree about who the minimum applies to.
   */
  const { isPureB2B } = require("@/lib/priceTierHelper");
  const canReachB2bPricing = customer?.role === "admin" || isPureB2B(customer?.customerTypes);

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
        <h1 className="text-3xl font-bold tracking-tight text-[#1c1d1f]">{product.title}</h1>
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

          {/* Comparative Price Tiers Grid (2 Rows x 2 Columns, Fully Responsive) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* 1. MRP with Strikethrough Cut Line */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-border/80 bg-secondary/15 flex flex-col justify-between min-w-0 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                  MRP
                </span>
                <span className="text-[8px] sm:text-[9px] font-semibold text-muted-foreground bg-secondary/40 px-1 py-0.2 rounded shrink-0">
                  Max Retail
                </span>
              </div>
              <div className="mt-auto pt-0.5">
                <span className="text-base sm:text-xl md:text-2xl font-bold text-muted-foreground/80 line-through font-mono tracking-tight block truncate">
                  {formatPrice(mrp)}
                </span>
              </div>
            </div>

            {/* 2. Selling Price (B2C) */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-950/20 flex flex-col justify-between min-w-0 shadow-2xs transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 truncate">
                  B2C Price
                </span>
                <span className="text-[8px] sm:text-[9px] font-extrabold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded shrink-0">
                  Retail
                </span>
              </div>
              <div className="mt-auto pt-0.5">
                <span className="text-lg sm:text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight block truncate">
                  {formatPrice(b2cPrice)}
                </span>
              </div>
            </div>

            {/* 3. Trade Price (B2B) */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border border-blue-500/35 bg-blue-500/10 dark:bg-blue-950/20 flex flex-col justify-between min-w-0 shadow-2xs transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 truncate">
                  Trade Price (B2B)
                </span>
                <span className="text-[8px] sm:text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-2xs shrink-0">
                  MOQ: {b2bMoq}
                </span>
              </div>
              <div className="mt-auto pt-0.5">
                <span className="text-lg sm:text-xl md:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight block truncate">
                  {b2bPrice > 0 ? formatPrice(b2bPrice) : "N/A"}
                </span>
              </div>
            </div>

            {/* 4. Dropship Price (Extra Highlighted) */}
            <div className="p-2.5 sm:p-3.5 rounded-xl border-2 border-purple-500/60 bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-pink-500/10 dark:from-purple-950/40 dark:to-pink-950/30 flex flex-col justify-between min-w-0 shadow-sm relative overflow-hidden ring-2 ring-purple-500/20 transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-200 flex items-center gap-0.5 truncate">
                  ⭐ Dropship
                </span>
                <span className="text-[8px] sm:text-[9px] font-black bg-gradient-to-r from-purple-600 to-pink-600 text-white px-1.5 py-0.5 rounded-full shadow-2xs uppercase tracking-wider shrink-0">
                  Reseller
                </span>
              </div>
              <div className="mt-auto pt-0.5">
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-purple-700 dark:text-purple-300 font-mono tracking-tight block truncate">
                  {dropshippingPrice > 0 ? formatPrice(dropshippingPrice) : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* B2C Wholesale Incentive Banner */}
          {(() => {
            const { isB2bVerified } = require("@/lib/priceTierHelper");
            const isVerified = isB2bVerified(customer);
            if (!isVerified) {
              return (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-blue-500/10 rounded-xl border border-primary/30 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                        💼 Want Wholesale Rate ({b2bPrice > 0 ? formatPrice(b2bPrice) : "B2B Price"} / unit)?
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Verify your B2B profile & submit GST/KYC documents to unlock wholesale pricing when ordering {b2bMoq}+ units.
                      </p>
                    </div>
                    <a href={customer ? "/client/upgrade" : "/register?type=b2b"} className="shrink-0">
                      <button type="button" className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-all cursor-pointer shadow-sm">
                        Verify B2B Profile
                      </button>
                    </a>
                  </div>
                </div>
              );
            }
            return (
              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
                <span>
                  📦 Verified B2B Account • Order <strong>{b2bMoq}+</strong> units to automatically unlock wholesale price ({b2bPrice > 0 ? formatPrice(b2bPrice) : "B2B Rate"} / unit)!
                </span>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center gap-4 text-xs pt-2">
            {(activeSubVariant?.stock || 0) > 0 ? (
              <Badge variant="success">In Stock</Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}

            {/*
              Shown only to viewers who can actually reach wholesale pricing. A B2C or
              Dropshipping shopper was being told about a minimum that does not apply to
              them — and, until the cart was fixed, was then silently held to it.
            */}
            {b2bMoq > 1 && canReachB2bPricing && (
              <Badge variant="outline" className="border-amber-500/60 text-amber-800 dark:text-amber-300 font-extrabold bg-amber-50/50 dark:bg-amber-950/20">
                • MOQ: {b2bMoq} pcs
              </Badge>
            )}

            {visibility.showDimensions && activeVariant?.dimensions && (
              <span className="text-muted-foreground font-semibold">• Box Size: {activeVariant.dimensions}</span>
            )}

            {(() => {
              const { calculateVolumetricWeightGrams, parseDimensionsToCm } = require("@/lib/priceTierHelper");
              const parsed = parseDimensionsToCm(activeVariant?.dimensions);
              const l = (activeVariant?.lengthCm !== undefined && activeVariant?.lengthCm !== null && activeVariant?.lengthCm > 0)
                ? activeVariant.lengthCm
                : parsed.lengthCm;
              const b = (activeVariant?.breadthCm !== undefined && activeVariant?.breadthCm !== null && activeVariant?.breadthCm > 0)
                ? activeVariant.breadthCm
                : parsed.breadthCm;
              const h = (activeVariant?.heightCm !== undefined && activeVariant?.heightCm !== null && activeVariant?.heightCm > 0)
                ? activeVariant.heightCm
                : parsed.heightCm;

              const volWeightGrams = Math.round(calculateVolumetricWeightGrams(l, b, h));
              return volWeightGrams > 0 ? (
                <span className="text-muted-foreground font-semibold">• Volumetric Weight: {volWeightGrams}g</span>
              ) : null;
            })()}

            <span className="text-muted-foreground font-semibold">
              • HSN Code: <strong className="font-mono text-foreground">{product.hsnCode || "3924"}</strong> (GST {gstRate}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
