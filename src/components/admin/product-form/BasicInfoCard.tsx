"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useProductForm } from "./ProductFormContext";
import { Code, Eye } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";

const RichTextEditor = dynamic(() => import("../RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[220px] bg-secondary/10 border border-input rounded-md flex items-center justify-center text-muted-foreground text-sm">
      Loading editor...
    </div>
  ),
});

export function BasicInfoCard() {
  const {
    title,
    setTitle,
    categoryId,
    setCategoryId,
    categories,
    tagsText,
    setTagsText,
    cardTagsText,
    setCardTagsText,
    editorMode,
    setEditorMode,
    description,
    setDescription
  } = useProductForm();

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <h3 className="font-bold text-lg border-b pb-2">Basic Info</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Product Title / Name *</label>
            <Input
              placeholder="e.g. Mitti Handi / Clay Cookware"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            >
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Search & SEO Tags (comma separated)</label>
            <Input
              placeholder="e.g., clay pots, water cooler, kettle"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Used exclusively for search query matching and SEO metadata keywords index.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Product Card Badges / Tags (comma separated)</label>
            <Input
              placeholder="e.g., bestseller, new, trending, kitchen"
              value={cardTagsText}
              onChange={(e) => setCardTagsText(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Pills/badges shown on website cards (e.g. bestseller, new, trending).
            </p>
          </div>
        </div>

        {/* Rich Text Editor for Description */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Description *</label>
            <div className="flex bg-secondary/50 rounded-md p-0.5 border">
              <button
                type="button"
                onClick={() => setEditorMode("edit")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${editorMode === "edit" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <Code className="h-3 w-3" /> Edit HTML
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("preview")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 cursor-pointer ${editorMode === "preview" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
              >
                <Eye className="h-3 w-3" /> Preview
              </button>
            </div>
          </div>

          {editorMode === "edit" ? (
            <RichTextEditor value={description} onChange={setDescription} />
          ) : (
            <div
              className="border rounded-md p-4 min-h-[210px] bg-secondary/10 prose prose-sm max-w-none text-foreground overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) || "<p className='text-muted-foreground italic'>Description preview is empty.</p>" }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
