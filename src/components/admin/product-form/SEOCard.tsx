"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useProductForm } from "./ProductFormContext";
import { Sparkles } from "lucide-react";

export function SEOCard() {
  const {
    seoTitle,
    setSeoTitle,
    seoDescription,
    setSeoDescription,
    seoKeywords,
    setSeoKeywords,
    autoGenerateSEO
  } = useProductForm();

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-lg">Search Engine Optimization (SEO)</h3>
          <Button type="button" size="sm" variant="outline" onClick={autoGenerateSEO} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Generate SEO Tags
          </Button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Meta Tag Title</label>
            <Input
              placeholder="Seo friendly browser title tag..."
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Meta Tag Description</label>
            <textarea
              rows={2}
              placeholder="Seo description for search index snippets..."
              className="w-full p-3 rounded-lg border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-primary"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold">Meta Keywords (comma separated)</label>
            <Input
              placeholder="Keywords matching search queries..."
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
