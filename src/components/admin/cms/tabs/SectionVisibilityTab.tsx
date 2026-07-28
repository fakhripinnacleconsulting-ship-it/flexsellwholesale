"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Save, Eye, EyeOff } from "lucide-react";
import { HomepageVisibilityData } from "../types";

interface SectionVisibilityTabProps {
  data: HomepageVisibilityData;
  setData: React.Dispatch<React.SetStateAction<HomepageVisibilityData>>;
  isSaving: boolean;
  onSave: (key: string, value: any) => Promise<void>;
}

export function SectionVisibilityTab({
  data,
  setData,
  isSaving,
  onSave,
}: SectionVisibilityTabProps) {
  const handleToggle = (field: keyof HomepageVisibilityData) => {
    setData((prev) => ({
      ...prev,
      [field]: prev[field] === false ? true : false,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave("homepage_settings", data);
  };

  const sectionsList: { key: keyof HomepageVisibilityData; title: string; desc: string }[] = [
    { key: "showHeroBanners", title: "Top Hero Banner Slider", desc: "Show main top banner & video slider" },
    { key: "showTrustBar", title: "Trust Counter Bar", desc: "Show trust stats (5,000+ items, orders shipped, etc.)" },
    { key: "showCategories", title: "Shop Categories Grid", desc: "Show top product category cards" },
    { key: "showFeaturedCollections", title: "Special Collections Grid", desc: "Show handpicked sourcing collection cards" },
    { key: "showWholesaleBiz", title: "Wholesale Business Highlights", desc: "Show B2B direct factory rate features" },
    { key: "showTrendingProducts", title: "Fast Selling Products Grid", desc: "Show highest demand trending products" },
    { key: "showNewArrivals", title: "Fresh Stock Grid", desc: "Show latest stock items added this week" },
    { key: "showDropshipBiz", title: "Dropship Program Section", desc: "Show zero-inventory dropshipping features" },
    { key: "showBrandPartners", title: "Brand Partners Bar", desc: "Show partner brand logos marquee bar" },
    { key: "showRecommendedProducts", title: "Recommended Items Slider", desc: "Show recommended product slider" },
    { key: "showTestimonials", title: "Customer Reviews Block", desc: "Show retailer and buyer review cards" },
  ];

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Homepage Section Show/Hide Controls
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Turn any section ON or OFF to choose what appears on your live storefront homepage.
          </p>
        </div>
        <Button
          type="submit"
          disabled={isSaving}
          className="font-bold text-xs gap-1.5 cursor-pointer"
        >
          <Save className="h-4 w-4" /> Save Show/Hide Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sectionsList.map((item) => {
          const isVisible = data?.[item.key] !== false;
          return (
            <div
              key={item.key}
              onClick={() => handleToggle(item.key)}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between ${
                isVisible
                  ? "bg-primary/5 border-primary/40 shadow-xs"
                  : "bg-muted/40 border-border/60 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-xs text-foreground flex items-center gap-1.5">
                    {isVisible ? (
                      <Eye className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {item.desc}
                  </p>
                </div>
                <div
                  className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors shrink-0 ${
                    isVisible ? "bg-primary" : "bg-muted-foreground/30"
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isVisible ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-border/40 text-[10px] font-extrabold uppercase tracking-wider">
                <span className={isVisible ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                  {isVisible ? "● Visible on Storefront" : "○ Hidden from Storefront"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button
          type="submit"
          disabled={isSaving}
          className="font-bold text-xs gap-1.5 cursor-pointer px-6"
        >
          <Save className="h-4 w-4" /> Save Layout Visibility
        </Button>
      </div>
    </form>
  );
}
