"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";
import { FileText, Plus, Pencil, Trash2, ExternalLink, X } from "lucide-react";

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminPagesPage() {
  const { addToast } = useToastStore();
  const [pages, setPages] = React.useState<StaticPage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingPage, setEditingPage] = React.useState<StaticPage | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [content, setContent] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");

  const fetchPages = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/cms");
      const data = await res.json();
      setPages(Array.isArray(data?.staticPages) ? data.staticPages : []);
    } catch (err) {
      console.error("Failed to load static pages:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const openCreateModal = () => {
    setEditingPage(null);
    setTitle("");
    setSlug("");
    setContent("");
    setIsActive(true);
    setSeoTitle("");
    setSeoDescription("");
    setModalOpen(true);
  };

  const openEditModal = (page: StaticPage) => {
    setEditingPage(page);
    setTitle(page.title);
    setSlug(page.slug);
    setContent(page.content);
    setIsActive(page.isActive);
    setSeoTitle(page.seoTitle || "");
    setSeoDescription(page.seoDescription || "");
    setModalOpen(true);
  };

  const persistPages = async (updated: StaticPage[]) => {
    const res = await fetch("/api/cms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "staticPages", value: updated }),
    });
    if (!res.ok) throw new Error("Failed to save static pages");
    setPages(updated);
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      addToast("Title and URL slug are required.", "warning");
      return;
    }
    const cleanSlug = slugify(slug);
    const duplicate = pages.find((p) => p.slug === cleanSlug && p.id !== editingPage?.id);
    if (duplicate) {
      addToast(`A page with the URL slug "${cleanSlug}" already exists.`, "error");
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      let updated: StaticPage[];
      if (editingPage) {
        updated = pages.map((p) =>
          p.id === editingPage.id
            ? { ...p, title, slug: cleanSlug, content, isActive, seoTitle, seoDescription, updatedAt: now }
            : p
        );
      } else {
        const newPage: StaticPage = {
          id: `page-${Date.now()}`,
          title,
          slug: cleanSlug,
          content,
          isActive,
          seoTitle,
          seoDescription,
          updatedAt: now,
        };
        updated = [newPage, ...pages];
      }
      await persistPages(updated);
      addToast(editingPage ? "Page updated successfully!" : "Page created successfully!", "success");
      setModalOpen(false);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save page", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const updated = pages.filter((p) => p.id !== deleteId);
      await persistPages(updated);
      addToast("Page deleted successfully.", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to delete page", "error");
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Static Pages</h1>
          <p className="text-muted-foreground mt-1">Create custom content pages (About, landing pages, etc.) visible at /pages/[slug].</p>
        </div>
        <Button onClick={openCreateModal} className="font-bold gap-2">
          <Plus className="h-4 w-4" /> New Page
        </Button>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">Loading pages...</p>
      ) : pages.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title="No static pages yet" description="Create your first custom content page using the 'New Page' button above." />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <Card key={page.id} className="border border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" /> {page.title}
                  </CardTitle>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${page.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500" : "bg-secondary text-muted-foreground"}`}>
                    {page.isActive ? "Published" : "Draft"}
                  </span>
                </div>
                <CardDescription className="font-mono text-xs">/pages/{page.slug}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-2 pt-0">
                <a href={`/pages/${page.slug}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="h-8 text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                </a>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditModal(page)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs text-destructive hover:bg-destructive/5" onClick={() => setDeleteId(page.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-lg">{editingPage ? "Edit Page" : "New Static Page"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg hover:bg-secondary cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Page Title *</label>
                <Input value={title} onChange={(e) => {
                  setTitle(e.target.value);
                  if (!editingPage) setSlug(slugify(e.target.value));
                }} placeholder="e.g. Our Story" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">URL Slug *</label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="our-story" className="font-mono text-sm" />
                <p className="text-[11px] text-muted-foreground">Will be visible at /pages/{slugify(slug) || "your-slug"}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Page Content (HTML) *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-primary"
                  placeholder="<h2>Heading</h2><p>Your content here...</p>"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">SEO Title</label>
                  <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">SEO Description</label>
                  <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="Optional" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                <span className="text-sm font-semibold">Published (visible to visitors)</span>
              </label>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving} className="font-bold">
                {isSaving ? "Saving..." : editingPage ? "Save Changes" : "Create Page"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4">
            <h3 className="font-bold text-base">Delete this page?</h3>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button size="sm" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
