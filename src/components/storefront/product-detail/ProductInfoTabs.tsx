"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useProductDetail } from "./ProductDetailContext";
import { sanitizeHtml } from "@/lib/sanitize";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sliders, Truck, ShieldCheck } from "lucide-react";

export function ProductInfoTabs() {
  const { product, isDescExpanded, setIsDescExpanded, activeVariant, activeSubVariant } = useProductDetail();
  const [activeTab, setActiveTab] = React.useState<"description" | "specifications" | "shipping">("description");
  const [selectedBreakdownTier, setSelectedBreakdownTier] = React.useState<"B2C" | "B2B" | "Dropshipping">("B2C");
  const [breakdownQty, setBreakdownQty] = React.useState<number>(1);
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    fetch("/api/shipping")
      .then(r => r.json())
      .then(data => setShippingConfig(data))
      .catch(() => { });
  }, []);

  React.useEffect(() => {
    if (selectedBreakdownTier === "B2B" && activeSubVariant?.b2bMoq) {
      setBreakdownQty(activeSubVariant.b2bMoq);
    }
  }, [selectedBreakdownTier, activeSubVariant]);

  if (!product) return null;

  const visibility = product.fieldVisibility || {
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  };

  return (
    <div className="space-y-4 border-t pt-6">
      {/* Tab Nav Headers */}
      <div className="flex border-b gap-4">
        {visibility.showDescription && product.description && (
          <button
            type="button"
            onClick={() => setActiveTab("description")}
            className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${activeTab === "description" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <FileText className="h-4 w-4" /> Description
            {activeTab === "description" && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("specifications")}
          className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${activeTab === "specifications" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Sliders className="h-4 w-4" /> Specifications
          {activeTab === "specifications" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shipping")}
          className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${activeTab === "shipping" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
        >
          <Truck className="h-4 w-4" /> Shipping & Freight
          {activeTab === "shipping" && (
            <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === "description" && (
          <motion.div
            key="description"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div className="relative">
              <div
                className={`text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert transition-all duration-300 overflow-hidden ${isDescExpanded ? "max-h-full" : "max-h-[160px] line-clamp-6"
                  }`}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || "") }}
              />
              {!isDescExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none" />
              )}
            </div>
            <Button
              variant="link"
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="text-primary font-bold p-0 h-auto text-xs flex items-center cursor-pointer"
            >
              {isDescExpanded ? "Show Less" : "Read Full Description"}
            </Button>
          </motion.div>
        )}

        {activeTab === "specifications" && (
          <motion.div
            key="specifications"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2 text-xs text-foreground"
          >
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
              <span className="text-muted-foreground font-medium">SKU Ref:</span>
              <span className="font-bold font-mono">{activeSubVariant?.sku || "FS-VAR-001"}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
              <span className="text-muted-foreground font-medium">Minimum Order Quantity (MOQ):</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{activeSubVariant?.b2bMoq || 1} pcs</span>
            </div>
            {activeSubVariant?.size && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
                <span className="text-muted-foreground font-medium">Dimensions / Size:</span>
                <span className="font-bold">{activeSubVariant.size}</span>
              </div>
            )}
            {activeSubVariant?.weight && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
                <span className="text-muted-foreground font-medium">Unit Weight:</span>
                <span className="font-bold">{activeSubVariant.weight}</span>
              </div>
            )}
            {activeVariant?.dimensions && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
                <span className="text-muted-foreground font-medium">Box Dimensions:</span>
                <span className="font-bold font-mono">{activeVariant.dimensions}</span>
              </div>
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
                <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
                  <span className="text-muted-foreground font-medium">Volumetric Weight:</span>
                  <span className="font-bold font-mono">{volWeightGrams}g</span>
                </div>
              ) : null;
            })()}
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
              <span className="text-muted-foreground font-medium">HSN Code & GST Tax:</span>
              <span className="font-bold font-mono">{product.hsnCode || "3924"} (GST {product.gstRate || 18}%)</span>
            </div>
          </motion.div>
        )}

        {activeTab === "shipping" && (
          <motion.div
            key="shipping"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6 text-xs text-muted-foreground leading-relaxed"
          >
            {/* 3 Customer Type Sub-Tabs */}
            <div className="space-y-4 bg-secondary/10 p-4 rounded-xl border border-border/60">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" /> Dynamic Cost & Shipping Breakdown
                </h4>
                <div className="flex bg-background border p-1 rounded-lg gap-1 text-[11px] font-bold">
                  {(["B2C", "B2B", "Dropshipping"] as const).map((tierKey) => (
                    <button
                      key={tierKey}
                      type="button"
                      onClick={() => setSelectedBreakdownTier(tierKey)}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${selectedBreakdownTier === tierKey
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/20"
                        }`}
                    >
                      {tierKey === "B2C" ? "B2C Retail" : tierKey === "B2B" ? "B2B Wholesale" : "Dropshipping"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Breakdown Card */}
              {(() => {
                const { calculateDetailedBreakdown } = require("@/lib/priceTierHelper");
                const breakdown = calculateDetailedBreakdown({
                  product,
                  variant: activeVariant,
                  subVariant: activeSubVariant,
                  tier: selectedBreakdownTier,
                  quantity: breakdownQty,
                  shippingConfig,
                });

                return (
                  <div className="space-y-4 text-foreground">
                    {/* Header info bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-background rounded-lg border text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Customer Segment</span>
                        <span className="font-bold text-primary">
                          {selectedBreakdownTier === "B2C" ? "Retail (B2C)" : selectedBreakdownTier === "B2B" ? "Wholesale (B2B Bulk)" : "Reseller (Dropshipping)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Selected Variation</span>
                        <span className="font-bold font-mono">
                          {activeSubVariant ? `${activeSubVariant.size} - ${activeSubVariant.weight}` : "Default"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Quantity:</span>
                        <input
                          type="number"
                          min={selectedBreakdownTier === "B2B" ? (activeSubVariant?.b2bMoq || 1) : 1}
                          value={breakdownQty}
                          onChange={(e) => setBreakdownQty(Math.max(1, Number(e.target.value)))}
                          className="w-16 h-7 text-xs font-bold text-center border rounded-md bg-background"
                        />
                      </div>
                    </div>

                    {/* Detailed Table */}
                    <div className="overflow-x-auto border rounded-lg bg-background">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-secondary/20 text-muted-foreground font-semibold border-b">
                          <tr>
                            <th className="p-2.5">Cost Component</th>
                            <th className="p-2.5">Calculation Details</th>
                            <th className="p-2.5 text-right">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 font-medium">
                          {/* Base Product Amount */}
                          <tr>
                            <td className="p-2.5 font-bold">
                              Base Selling Price
                              {selectedBreakdownTier === "B2B" && (
                                <span className="text-[10px] text-muted-foreground block font-normal">
                                  (MOQ: {activeSubVariant?.b2bMoq || 1} units)
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono">
                              ₹{breakdown.unitBasePrice.toFixed(2)} × {breakdown.quantity} unit(s)
                            </td>
                            <td className="p-2.5 text-right font-bold font-mono">
                              ₹{breakdown.totalProductPrice.toFixed(2)}
                            </td>
                          </tr>

                          {/* GST Tax Breakdown */}
                          <tr>
                            <td className="p-2.5">
                              <span className="font-bold">GST Tax ({breakdown.gstRate}%)</span>
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                HSN: {breakdown.hsnCode} • {breakdown.priceIncludesGst ? "Inclusive in Base" : "Exclusive Tax"}
                              </span>
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono text-[11px]">
                              CGST ({breakdown.gstRate / 2}%): ₹{breakdown.cgstAmount.toFixed(2)} + SGST ({breakdown.gstRate / 2}%): ₹{breakdown.sgstAmount.toFixed(2)}
                            </td>
                            <td className="p-2.5 text-right font-bold font-mono">
                              ₹{breakdown.totalTaxAmount.toFixed(2)}
                            </td>
                          </tr>

                          {/* Weight & Shipping Charge */}
                          <tr>
                            <td className="p-2.5">
                              <span className="font-bold">Freight & Shipping Charge</span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                  Actual: {breakdown.actualUnitWeightGrams}g
                                </Badge>
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                  Volumetric: {breakdown.volumetricUnitWeightGrams}g
                                </Badge>
                                <Badge variant={breakdown.appliedWeightType === "volumetric" ? "warning" : "secondary"} className="text-[9px] py-0 px-1">
                                  Chargeable: {breakdown.chargeableUnitWeightGrams}g ({breakdown.appliedWeightType === "volumetric" ? "Volumetric Applied" : "Actual Applied"})
                                </Badge>
                              </div>
                            </td>
                            <td className="p-2.5 text-muted-foreground font-mono text-[11px]">
                              Total Chargeable: {(breakdown.totalChargeableWeightGrams / 1000).toFixed(2)} kg
                            </td>
                            <td className="p-2.5 text-right font-bold font-mono text-blue-600 dark:text-blue-400">
                              ₹{breakdown.estimatedShippingCharge.toFixed(2) || 100}
                            </td>
                          </tr>

                          {/* Handling Charge */}
                          <tr>
                            <td className="p-2.5 font-bold">Handling Charge</td>
                            <td className="p-2.5 text-muted-foreground font-mono">
                              {breakdown.packagingChargeType === "per_order"
                                ? `₹${breakdown.totalPackagingCharge.toFixed(2)} (Flat Per Order)`
                                : `₹${breakdown.unitPackagingCharge.toFixed(2)} × ${breakdown.quantity} unit(s)`}
                            </td>
                            <td className="p-2.5 text-right font-bold font-mono">
                              ₹{breakdown.totalPackagingCharge.toFixed(2)}
                            </td>
                          </tr>

                          {/* Total Estimated Cost */}
                          <tr className="bg-primary/10 text-primary font-black border-t text-xs">
                            <td className="p-3">ESTIMATED TOTAL LANDED COST</td>
                            <td className="p-3 font-mono text-[11px]">
                              Per Unit Landed: ₹{breakdown.unitLandedPrice.toFixed(2)}
                            </td>
                            <td className="p-3 text-right text-sm font-black font-mono">
                              ₹{breakdown.totalLandedOrderAmount.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Informational dispatch banners */}
            <div className="flex gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Truck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Express Bhopal Central Dispatch</p>
                <p>All wholesale orders are packed and handed over to Delhivery, V-Trans, or Gati transport within 24-48 working hours.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Transit Damage Replacement Guarantee</p>
                <p>Comprehensive product replacement guarantee for breakages in transit when an unboxing video is provided within 48 hours of receipt.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
