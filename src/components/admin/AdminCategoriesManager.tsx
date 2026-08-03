"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, Edit, Trash2, X, Check, Image as ImageIcon, Search, Filter, SortAsc, Eye } from "lucide-react";
import { useCategoryStore } from "@/stores/categoryStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { Category } from "@/types";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { Pagination } from "@/components/ui/Pagination";
import { ViewDetailsDialog } from "../ui/ViewDetailsDialog";
import { usePermissions } from "@/hooks/usePermissions";

interface AdminCategoriesManagerProps {
  initialCategories: Category[];
}

export function AdminCategoriesManager({ initialCategories }: AdminCategoriesManagerProps) {
  const { categories, initializeCategories, addCategory, updateCategory, deleteCategory } = useCategoryStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const { hasPermission } = usePermissions();

  const [editCategoryId, setEditCategoryId] = React.useState<string | null>(null);

  // Form states
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [image, setImage] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [parentId, setParentId] = React.useState("");

  // Search, Sort, Filter states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("name-asc"); // name-asc, name-desc, newest
  const [filterParent, setFilterParent] = React.useState("all");

  React.useEffect(() => {
    initializeCategories(initialCategories);
  }, [initialCategories, initializeCategories]);

  const activeCategories = categories.length > 0 ? categories : initialCategories;
  const parentCategories = activeCategories.filter(c => !c.parentId);

  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 10;

  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const truncateString = (str: string, max: number = 50) => {
    if (!str) return str;
    return str.length > max ? str.substring(0, max) + "..." : str;
  };

  const filteredAndSortedCategories = React.useMemo(() => {
    let result = [...activeCategories];

    // Search
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(lowerQ) ||
        c.slug.toLowerCase().includes(lowerQ)
      );
    }

    // Filter
    if (filterParent !== "all") {
      if (filterParent === "root") {
        result = result.filter(c => !c.parentId);
      } else {
        result = result.filter(c => c.parentId === filterParent);
      }
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      if (sortBy === "newest") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return result;
  }, [activeCategories, searchQuery, filterParent, sortBy]);

  const totalPages = Math.ceil(filteredAndSortedCategories.length / ITEMS_PER_PAGE);

  const paginatedCategories = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedCategories.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedCategories, currentPage]);

  // Load selected category into the form
  const handleEditClick = (cat: Category) => {
    setEditCategoryId(cat._id);
    setName(cat.name);
    setSlug(cat.slug);
    setImage(cat.image || "");
    setDescription(cat.description || "");
    setParentId(cat.parentId || "");
  };

  const handleCancelEdit = () => {
    setEditCategoryId(null);
    setName("");
    setSlug("");
    setImage("");
    setDescription("");
    setParentId("");
  };

  const validateImageAspectRatio = (src: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (Math.abs(ratio - 1) <= 0.01) {
          resolve(true);
        } else {
          resolve(false);
        }
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = src;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const isValid = await validateImageAspectRatio(objectUrl);
    URL.revokeObjectURL(objectUrl);

    if (!isValid) {
      addToast("Category image must have an exact 1:1 (square) aspect ratio.", "error");
      e.target.value = "";
      return;
    }

    addToast("Uploading category image...", "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to upload image");
      }

      const { url } = await res.json();
      setImage(url);
      addToast("Category image uploaded successfully.", "success");
    } catch (err: unknown) {
      console.error(err);
      addToast(err instanceof Error ? (err as any).message : "Failed to upload image.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !slug) {
      addToast("Name and Slug are required.", "warning");
      return;
    }

    const categoryData = {
      name,
      slug: slug.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      image: image || ("https://placehold.co/400x400/10b981/ffffff?text=" + name.split(" ")[0]),
      description,
      parentId: parentId || null,
      order: 1, // Defaulting to 1 as requested to remove it from UI but keep DB schema valid
      isActive: true
    };

    const performSave = async () => {
      try {
        if (editCategoryId) {
          await updateCategory(editCategoryId, categoryData);
          addToast(`Category "${name}" updated successfully!`, "success");
        } else {
          await addCategory(categoryData);
          addToast(`Category "${name}" created successfully!`, "success");
        }
        handleCancelEdit();
      } catch (error: unknown) {
        addToast((error as any).message || "An error occurred while saving the category.", "error");
      }
    };

    if (editCategoryId) {
      confirmAction({
        title: "Confirm Update",
        message: `Are you sure you want to save changes to the category "${name}"?`,
        confirmText: "Save Changes",
        cancelText: "Cancel",
        type: "warning",
        onConfirm: performSave
      });
    } else {
      await performSave();
    }
  };

  const handleDeleteClick = (cat: Category) => {
    confirmAction({
      title: "Delete Category",
      message: `Are you sure you want to permanently delete category "${cat.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteCategory(cat._id);
          addToast(`Category "${cat.name}" deleted successfully!`, "success");
        } catch (error: unknown) {
          addToast((error as any).message || "An error occurred while deleting the category.", "error");
        }
      }
    });
  };

  // Selected item for View Dialog
  const [viewCategory, setViewCategory] = React.useState<Category | null>(null);

  return (
    <div className="space-y-6">
      <ViewDetailsDialog
        isOpen={!!viewCategory}
        onClose={() => setViewCategory(null)}
        title="Category Details"
        data={viewCategory ? {
          id: viewCategory._id,
          name: viewCategory.name,
          slug: viewCategory.slug,
          parentId: viewCategory.parentId || "None (Root)",
          description: viewCategory.description || "No description",
          image: viewCategory.image || null,
          isActive: viewCategory.isActive,
          createdAt: viewCategory.createdAt,
          updatedAt: viewCategory.updatedAt
        } : {}}
      />
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-1">Configure parent-child taxonomies for your B2B Mega Menu.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left/Middle Column: List of Categories */}
        <div className={`space-y-4 ${hasPermission("catalog_categories", "create") || hasPermission("catalog_categories", "update") ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search categories..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <select
              value={filterParent}
              onChange={(e) => { setFilterParent(e.target.value); setCurrentPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            >
              <option value="all">All Categories</option>
              <option value="root">Root Categories Only</option>
              {parentCategories.map(cat => (
                <option key={cat._id} value={cat._id}>Child of: {truncateString(cat.name, 30)}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>

          <Card>
            <CardContent className="p-0">
              <div
                className="overflow-x-auto custom-scrollbar cursor-grab active:cursor-grabbing select-none"
                ref={ref}
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
              >
                <table className="w-full text-sm text-left text-foreground whitespace-nowrap" onDragStart={onDragStart}>
                  <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                    <tr>
                      <th className="px-6 py-4 font-semibold tracking-wide">ID</th>
                      <th className="px-6 py-4 font-semibold tracking-wide">Name</th>
                      <th className="px-6 py-4 font-semibold tracking-wide">Image</th>
                      <th className="px-6 py-4 font-semibold tracking-wide">Slug</th>
                      <th className="px-6 py-4 font-semibold tracking-wide">Parent</th>
                      <th className="px-6 py-4 font-semibold tracking-wide text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedCategories.map((cat) => {
                      const parent = activeCategories.find(c => c._id === cat.parentId);
                      return (
                        <tr key={cat._id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs max-w-[120px] truncate" title={cat._id}>{truncateString(cat._id, 15)}</td>
                          <td className="px-6 py-4 font-bold max-w-[200px] truncate" title={cat.name}>
                            {cat.parentId ? (
                              <span className="text-muted-foreground font-normal ml-3">— </span>
                            ) : null}
                            {truncateString(cat.name, 40)}
                          </td>
                          <td className="px-6 py-4">
                            {cat.image ? (
                              <img src={cat.image} alt={cat.name} className="h-10 w-10 object-cover rounded border" />
                            ) : (
                              <div className="h-10 w-10 bg-secondary rounded border flex items-center justify-center text-muted-foreground">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs max-w-[150px] truncate" title={cat.slug}>{truncateString(cat.slug, 30)}</td>
                          <td className="px-6 py-4 text-muted-foreground max-w-[150px] truncate" title={parent ? parent.name : "None (Root)"}>
                            {truncateString(parent ? parent.name : "None (Root)", 30)}
                          </td>
                          <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Details"
                              onClick={() => setViewCategory(cat)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {hasPermission("catalog_categories", "update") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit Category"
                                onClick={() => handleEditClick(cat)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {hasPermission("catalog_categories", "delete") && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10"
                                title="Delete Category"
                                onClick={() => handleDeleteClick(cat)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages || 1}
                  onPageChange={setCurrentPage}
                  totalItems={filteredAndSortedCategories.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Add/Edit Form Card */}
        {(hasPermission("catalog_categories", "create") || hasPermission("catalog_categories", "update")) && (
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-foreground">
                  {editCategoryId ? "Edit Category" : "Add B2B Category"}
                </CardTitle>
                <CardDescription>
                  {editCategoryId ? "Modify catalog properties for this category node" : "Insert a new category into the taxonomy"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-4 text-foreground">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category Name</label>
                    <Input
                      placeholder="e.g., Kitchen Storage"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (!editCategoryId) {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                        }
                      }}
                      required
                      disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">URL Slug</label>
                    <Input
                      placeholder="e.g., kitchen-storage"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      required
                      disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium flex justify-between">
                      Category Image
                      <span className="text-xs text-muted-foreground font-normal">* 1:1 aspect ratio mandated</span>
                    </label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={image}
                        onChange={(e) => setImage(e.target.value)}
                        className="flex-1"
                        disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}
                      />
                      <div className="relative">
                        <Button type="button" variant="outline" className="w-[100px]" disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}>
                          Upload
                        </Button>
                        {hasPermission("catalog_categories", editCategoryId ? "update" : "create") && (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                        )}
                      </div>
                    </div>
                    {image && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-1">Preview (Square Crop):</p>
                        <img src={image} alt="Preview" className="h-20 w-20 object-cover rounded border" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      placeholder="Description..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Parent Category (Optional)</label>
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground"
                      disabled={!hasPermission("catalog_categories", editCategoryId ? "update" : "create")}
                    >
                      <option value="">None (Root Category)</option>
                      {parentCategories
                        .filter(c => c._id !== editCategoryId) // prevent self-parenting
                        .map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-2">
                    {hasPermission("catalog_categories", editCategoryId ? "update" : "create") && (
                      <Button type="submit" className="flex-1">
                        {editCategoryId ? "Save Changes" : "Create Node"}
                      </Button>
                    )}
                    {editCategoryId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

