"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { useProductDetail } from "./ProductDetailContext";
import { sanitizeHtml } from "@/lib/sanitize";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Sliders, Truck, ShieldCheck } from "lucide-react";

export function ProductInfoTabs() {
  const { product, isDescExpanded, setIsDescExpanded, activeSubVariant } = useProductDetail();
  const [activeTab, setActiveTab] = React.useState<"description" | "specifications" | "shipping">("description");

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
            className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${
              activeTab === "description" ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
          className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === "specifications" ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
          className={`pb-3 font-bold text-sm transition-all relative cursor-pointer flex items-center gap-1.5 ${
            activeTab === "shipping" ? "text-primary" : "text-muted-foreground hover:text-foreground"
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
                className={`text-muted-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert transition-all duration-300 overflow-hidden ${
                  isDescExpanded ? "max-h-full" : "max-h-[160px] line-clamp-6"
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
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
              <span className="text-muted-foreground font-medium">GST Tax Rate:</span>
              <span className="font-bold">{product.gstRate || 18}% ({product.priceIncludesGst ? "Inclusive" : "Exclusive"})</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/15 rounded-lg border">
              <span className="text-muted-foreground font-medium">Standard HSN Code:</span>
              <span className="font-bold font-mono">{product.hsnCode || "39241090"}</span>
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
            className="space-y-3 text-xs text-muted-foreground leading-relaxed"
          >
            <div className="flex gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <Truck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Express Surat Central Dispatch</p>
                <p>All wholesale cargo orders are packed and handed over to Delhivery, V-Trans, or Gati transport within 24-48 working hours.</p>
              </div>
            </div>
            <div className="flex gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">Transit Damage Replacement Guarantee</p>
                <p>Comprehensive cargo replacement guarantee for breakages in transit when an unboxing video is provided within 48 hours of receipt.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
