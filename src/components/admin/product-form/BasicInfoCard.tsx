"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useProductForm } from "./ProductFormContext";
import { Code, Eye, Plus, RefreshCw, X, FolderPlus } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import { useCategoryStore } from "@/stores/categoryStore";
import { useToastStore } from "@/stores/toastStore";

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

  const { initializeCategories, addCategory } = useCategoryStore();
  const { addToast } = useToastStore();

  const [isQuickCategoryOpen, setIsQuickCategoryOpen] = React.useState(false);
  const [newCatName, setNewCatName] = React.useState("");
  const [newCatSlug, setNewCatSlug] = React.useState("");
  const [newCatParentId, setNewCatParentId] = React.useState("");
  const [isSubmittingCat, setIsSubmittingCat] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefreshCategories = async () => {
    setIsRefreshing(true);
    try {
      await initializeCategories(undefined, true);
      addToast("Categories list refreshed successfully!", "success");
    } catch (err) {
      addToast("Failed to refresh categories", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmittingCat(true);
    try {
      const generatedSlug = newCatSlug.trim()
        ? newCatSlug.toLowerCase().replace(/\s+/g, "-")
        : newCatName.toLowerCase().replace(/\s+/g, "-");

      const created = await addCategory({
        name: newCatName.trim(),
        slug: generatedSlug,
        parentId: newCatParentId || undefined,
        image: "",
        isActive: true,
        order: categories.length + 1
      });

      addToast(`Category "${created.name}" created and selected!`, "success");
      setCategoryId(created._id);
      setIsQuickCategoryOpen(false);
      setNewCatName("");
      setNewCatSlug("");
      setNewCatParentId("");
    } catch (err: any) {
      addToast(err?.message || "Failed to create category", "error");
    } finally {
      setIsSubmittingCat(false);
    }
  };

  return (
    <Card className="border border-border">
      <CardContent className="p-6 space-y-6">
        <h3 className="font-bold text-lg border-b pb-2">Basic Info</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Category *</label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRefreshCategories}
                  disabled={isRefreshing}
                  className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  title="Refresh categories list"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} /> Sync
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickCategoryOpen(true)}
                  className="h-6 px-2 text-[11px] font-bold flex items-center gap-1 cursor-pointer text-primary border-primary/30 hover:bg-primary/5"
                >
                  <Plus className="h-3 w-3" /> Quick Add
                </Button>
              </div>
            </div>

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground font-medium"
              required
            >
              {categories.length === 0 ? (
                <option value="">No categories available (Click Quick Add)</option>
              ) : (
                categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))
              )}
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

      {/* Quick Add Category Modal */}
      {isQuickCategoryOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 text-foreground space-y-4 shadow-2xl animate-in fade-in duration-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-primary" /> Create New Category
              </h3>
              <button
                type="button"
                onClick={() => setIsQuickCategoryOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Category Name *</label>
                <Input
                  placeholder="e.g. Kitchenware & Appliances"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Category Slug (Optional)</label>
                <Input
                  placeholder="e.g. kitchenware-appliances"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Parent Category (Optional)</label>
                <select
                  value={newCatParentId}
                  onChange={(e) => setNewCatParentId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus-visible:outline-none"
                >
                  <option value="">None (Top Level Category)</option>
                  {categories.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsQuickCategoryOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCat}
                  className="font-bold"
                >
                  {isSubmittingCat ? "Creating..." : "Save & Select Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
