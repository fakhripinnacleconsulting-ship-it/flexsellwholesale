"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Save, Search, Sparkles } from "lucide-react";
import { HomepageSeoData } from "../types";

interface HomepageSeoTabProps {
  data: HomepageSeoData;
  setData: React.Dispatch<React.SetStateAction<HomepageSeoData>>;
  isSaving: boolean;
  onSave: (key: string, value: any) => Promise<void>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => Promise<void>;
}

export function HomepageSeoTab({
  data,
  setData,
  isSaving,
  onSave,
  onFileUpload,
}: HomepageSeoTabProps) {
  const handleChange = (field: keyof HomepageSeoData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave("homepage_seo", data);
  };

  const handleAutoGenerate = () => {
    setData({
      seoTitle: "FlexSell Wholesale | Direct Factory Wholesale Sourcing Platform India",
      seoDescription: "Buy bulk wholesale products at lowest factory rates direct from Bhopal Central Warehouse. Fast dispatch, GST invoice, and zero-inventory dropshipping.",
      seoKeywords: "wholesale market Bhopal, B2B wholesale India, factory rate products, dropshipping supplier, bulk buy online",
      ogImageUrl: data?.ogImageUrl || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80",
    });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Homepage SEO & Search Engine Settings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set up how your homepage title and description appear on Google, WhatsApp, and social media.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoGenerate}
            className="text-xs font-semibold gap-1 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" /> Auto-Fill Simple SEO
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="font-bold text-xs gap-1.5 cursor-pointer"
          >
            <Save className="h-4 w-4" /> Save SEO Settings
          </Button>
        </div>
      </div>

      <div className="space-y-5 bg-secondary/10 p-5 rounded-xl border border-border/60 max-w-4xl">
        {/* SEO Title */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-muted-foreground">SEO Meta Title Tag *</label>
            <span className="text-[10px] text-muted-foreground font-mono font-semibold">
              {(data?.seoTitle || "").length} / 60 chars
            </span>
          </div>
          <Input
            value={data?.seoTitle || ""}
            onChange={(e) => handleChange("seoTitle", e.target.value)}
            placeholder="e.g. FlexSell Wholesale | Direct Factory Wholesale Sourcing Platform India"
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Appears as the main title on Google search results and browser tab.
          </p>
        </div>

        {/* SEO Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase text-muted-foreground">SEO Meta Description *</label>
            <span className="text-[10px] text-muted-foreground font-mono font-semibold">
              {(data?.seoDescription || "").length} / 160 chars
            </span>
          </div>
          <textarea
            rows={3}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={data?.seoDescription || ""}
            onChange={(e) => handleChange("seoDescription", e.target.value)}
            placeholder="e.g. Buy bulk wholesale products at lowest factory rates direct from Bhopal Central Warehouse..."
            required
          />
          <p className="text-[11px] text-muted-foreground">
            Snippet displayed below the title in search engine results.
          </p>
        </div>

        {/* SEO Keywords */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted-foreground">Meta Keywords (Comma-Separated)</label>
          <Input
            value={data?.seoKeywords || ""}
            onChange={(e) => handleChange("seoKeywords", e.target.value)}
            placeholder="e.g. wholesale India, B2B sourcing, dropshipping partner, bulk buy"
          />
        </div>

        {/* OG Share Image URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-muted-foreground">Open Graph Social Share Image URL</label>
          <div className="flex gap-2">
            <Input
              value={data?.ogImageUrl || ""}
              onChange={(e) => handleChange("ogImageUrl", e.target.value)}
              placeholder="e.g. https://domain.com/social-preview.jpg"
            />
            <label className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer shrink-0 flex items-center gap-1">
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFileUpload(e, "ogImageUrl")}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Image shown when your website link is shared on WhatsApp, Facebook, or Twitter.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t max-w-4xl">
        <Button
          type="submit"
          disabled={isSaving}
          className="font-bold text-xs gap-1.5 cursor-pointer px-6"
        >
          <Save className="h-4 w-4" /> Save SEO Settings
        </Button>
      </div>
    </form>
  );
}
