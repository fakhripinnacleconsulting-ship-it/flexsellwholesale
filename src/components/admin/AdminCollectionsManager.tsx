"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { 
  Plus, Edit, Trash2, X, Check, Image as ImageIcon, Search, 
  Filter, Star, Save, Layers, Settings, Globe, HelpCircle, Eye, AlertCircle, ArrowUp, ArrowDown
} from "lucide-react";
import { useCollectionStore } from "@/stores/collectionStore";
import { useCategoryStore } from "@/stores/categoryStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { Collection, Category, Product, CollectionCondition } from "@/types";
import { Pagination } from "@/components/ui/Pagination";
import { productService } from "@/services/productService";
import { collectionService } from "@/services/collectionService";
import { ProductSearchPicker } from "@/components/admin/ProductSearchPicker";
import { calculateProductRelevanceScore } from "@/services/searchService";

interface AdminCollectionsManagerProps {
  initialCollections: Collection[];
}

export function AdminCollectionsManager({ initialCollections }: AdminCollectionsManagerProps) {
  const { collections, initializeCollections, addCollection, updateCollection, deleteCollection } = useCollectionStore();
  const { categories, initializeCategories } = useCategoryStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  const [activeTab, setActiveTab] = React.useState<"list" | "form">("list");
  const [editCollectionId, setEditCollectionId] = React.useState<string | null>(null);

  // Form states
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<"manual" | "smart">("manual");
  const [image, setImage] = React.useState("");
  const [bannerImage, setBannerImage] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [isFeatured, setIsFeatured] = React.useState(false);
  const [order, setOrder] = React.useState(0);
  const [seoTitle, setSeoTitle] = React.useState("");
  const [seoDescription, setSeoDescription] = React.useState("");
  const [seoKeywords, setSeoKeywords] = React.useState("");

  // Linked Categories
  const [linkedCategoryIds, setLinkedCategoryIds] = React.useState<string[]>([]);

  // Manual Products Selection
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [allProducts, setAllProducts] = React.useState<Product[]>([]);
  const [productSearch, setProductSearch] = React.useState("");
  const [isSearchPickerOpen, setIsSearchPickerOpen] = React.useState(false);

  // Smart Rules Condition States
  const [matchType, setMatchType] = React.useState<"all" | "any">("all");
  const [conditions, setConditions] = React.useState<CollectionCondition[]>([
    { field: "tag", operator: "equals", value: "" }
  ]);
  const [previewProducts, setPreviewProducts] = React.useState<Product[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);

  // Active form sub-tab
  const [formSubTab, setFormSubTab] = React.useState<"general" | "products" | "rules" | "categories" | "seo">("general");

  // Search/Filter for Collection List
  const [listSearch, setListSearch] = React.useState("");
  const [listTypeFilter, setListTypeFilter] = React.useState<"all" | "manual" | "smart">("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 8;

  // Initialize
  React.useEffect(() => {
    initializeCollections(initialCollections);
    initializeCategories();
    fetchProductsData();
  }, [initialCollections, initializeCollections, initializeCategories]);

  const fetchProductsData = async () => {
    try {
      const data = await productService.getProducts();
      setAllProducts(data);
    } catch (err) {
      console.error("Failed to load products for picker", err);
    }
  };

  const handleEditClick = (col: Collection) => {
    setEditCollectionId(col._id);
    setTitle(col.title);
    setSlug(col.slug);
    setDescription(col.description || "");
    setType(col.type);
    setImage(col.image || "");
    setBannerImage(col.bannerImage || "");
    setIsActive(col.isActive);
    setIsFeatured(col.isFeatured);
    setOrder(col.order || 0);
    setLinkedCategoryIds(col.linkedCategoryIds || []);
    setSelectedProductIds(col.productIds || []);
    
    if (col.rules) {
      setMatchType(col.rules.matchType || "all");
      setConditions(col.rules.conditions || [{ field: "tag", operator: "equals", value: "" }]);
    } else {
      setMatchType("all");
      setConditions([{ field: "tag", operator: "equals", value: "" }]);
    }

    setSeoTitle(col.seoTitle || "");
    setSeoDescription(col.seoDescription || "");
    setSeoKeywords(col.seoKeywords || "");

    setFormSubTab("general");
    setActiveTab("form");
  };

  const handleCreateClick = () => {
    setEditCollectionId(null);
    setTitle("");
    setSlug("");
    setDescription("");
    setType("manual");
    setImage("");
    setBannerImage("");
    setIsActive(true);
    setIsFeatured(false);
    setOrder(0);
    setLinkedCategoryIds([]);
    setSelectedProductIds([]);
    setMatchType("all");
    setConditions([{ field: "tag", operator: "equals", value: "" }]);
    setSeoTitle("");
    setSeoDescription("");
    setSeoKeywords("");

    setFormSubTab("general");
    setActiveTab("form");
  };

  const handleCancelClick = () => {
    setActiveTab("list");
  };

  // Image Aspect Ratio Validator & Upload helper
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "thumbnail" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;

    addToast(`Uploading ${target}...`, "info");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image");
      }

      const { url } = await res.json();
      if (target === "thumbnail") {
        setImage(url);
      } else {
        setBannerImage(url);
      }
      addToast(`${target} uploaded successfully.`, "success");
    } catch (err: any) {
      addToast(err.message || "Failed to upload image.", "error");
    } finally {
      e.target.value = "";
    }
  };

  // Dynamic Rule Preview Engine on Client-Side
  const evaluateSmartRules = React.useCallback(() => {
    if (type !== "smart" || conditions.length === 0) return;
    setIsPreviewLoading(true);

    setTimeout(() => {
      const filtered = allProducts.filter(product => {
        const matchCondition = (cond: CollectionCondition) => {
          let productValue: any = "";
          if (cond.field === "tag") productValue = product.tags || [];
          else if (cond.field === "category") productValue = product.categoryId;
          else if (cond.field === "price") {
            let prices = product.colorVariants?.flatMap(cv => cv.subVariants?.map(sv => sv.b2cPrice) || []) || [];
            productValue = prices.length > 0 ? Math.min(...prices) : 0;
          } else if (cond.field === "title") productValue = product.title;
          else if (cond.field === "stock") productValue = product.totalStock || 0;
          else if (cond.field === "vendor") productValue = product.vendorId || "";

          const condVal = cond.value;
          const condNum = Number(condVal);
          const prodNum = Number(productValue);

          switch (cond.operator) {
            case "equals":
              if (cond.field === "tag") {
                return Array.isArray(productValue) && productValue.some(t => t.toLowerCase() === condVal.toLowerCase());
              }
              return String(productValue).toLowerCase() === condVal.toLowerCase();
            case "not_equals":
              if (cond.field === "tag") {
                return !Array.isArray(productValue) || !productValue.some(t => t.toLowerCase() === condVal.toLowerCase());
              }
              return String(productValue).toLowerCase() !== condVal.toLowerCase();
            case "contains":
              if (cond.field === "tag") {
                return Array.isArray(productValue) && productValue.some(t => t.toLowerCase().includes(condVal.toLowerCase()));
              }
              return String(productValue).toLowerCase().includes(condVal.toLowerCase());
            case "starts_with":
              if (cond.field === "tag") {
                return Array.isArray(productValue) && productValue.some(t => t.toLowerCase().startsWith(condVal.toLowerCase()));
              }
              return String(productValue).toLowerCase().startsWith(condVal.toLowerCase());
            case "greater_than":
              return prodNum > condNum;
            case "less_than":
              return prodNum < condNum;
            default:
              return false;
          }
        };

        if (matchType === "any") {
          return conditions.some(matchCondition);
        } else {
          return conditions.every(matchCondition);
        }
      });

      setPreviewProducts(filtered);
      setIsPreviewLoading(false);
    }, 300);
  }, [type, conditions, matchType, allProducts]);

  React.useEffect(() => {
    if (type === "smart" && formSubTab === "rules") {
      evaluateSmartRules();
    }
  }, [evaluateSmartRules, type, formSubTab]);

  // Form Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !slug) {
      addToast("Title and Slug are required fields.", "warning");
      return;
    }

    const payload: any = {
      title,
      slug: slug.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description,
      type,
      image,
      bannerImage,
      isActive,
      isFeatured,
      order: Number(order),
      linkedCategoryIds,
      seoTitle,
      seoDescription,
      seoKeywords,
    };

    if (type === "manual") {
      payload.productIds = selectedProductIds;
      payload.rules = null;
    } else {
      // Validate Smart Rules conditions
      const validConditions = conditions.filter(c => c.value.trim() !== "");
      if (validConditions.length === 0) {
        addToast("Please configure at least one active condition for the smart collection.", "warning");
        return;
      }
      payload.productIds = [];
      payload.rules = {
        matchType,
        conditions: validConditions
      };
    }

    const saveAction = async () => {
      try {
        if (editCollectionId) {
          await updateCollection(editCollectionId, payload);
          addToast(`Collection "${title}" updated successfully!`, "success");
        } else {
          await addCollection(payload);
          addToast(`Collection "${title}" created successfully!`, "success");
        }
        setActiveTab("list");
      } catch (err: any) {
        addToast(err.message || "Failed to save collection.", "error");
      }
    };

    if (editCollectionId) {
      confirmAction({
        title: "Update Collection",
        message: `Are you sure you want to save changes to "${title}"?`,
        confirmText: "Save",
        cancelText: "Cancel",
        type: "warning",
        onConfirm: saveAction
      });
    } else {
      await saveAction();
    }
  };

  const handleDelete = (col: Collection) => {
    confirmAction({
      title: "Delete Collection",
      message: `Are you sure you want to permanently delete the collection "${col.title}"? All product association links will be deleted. This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteCollection(col._id);
          addToast(`Collection "${col.title}" deleted successfully!`, "success");
        } catch (err: any) {
          addToast(err.message || "Failed to delete collection.", "error");
        }
      }
    });
  };

  // Toggle active/inactive
  const handleToggleActive = async (col: Collection) => {
    try {
      await updateCollection(col._id, { isActive: !col.isActive });
      addToast(`Collection status updated.`, "success");
    } catch (err: any) {
      addToast(err.message || "Failed to toggle collection status.", "error");
    }
  };

  // Toggle featured status
  const handleToggleFeatured = async (col: Collection) => {
    try {
      await updateCollection(col._id, { isFeatured: !col.isFeatured });
      addToast(`Collection featured status updated.`, "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update featured status.", "error");
    }
  };

  // List calculations
  const filteredCollections = React.useMemo(() => {
    let result = [...collections];

    // Search query
    if (listSearch) {
      const query = listSearch.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(query) || 
        c.slug.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query))
      );
    }

    // Type filter
    if (listTypeFilter !== "all") {
      result = result.filter(c => c.type === listTypeFilter);
    }

    return result;
  }, [collections, listSearch, listTypeFilter]);

  const totalPages = Math.ceil(filteredCollections.length / ITEMS_PER_PAGE);
  const paginatedCollections = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCollections.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCollections, currentPage]);

  const categoryMap = React.useMemo(() => {
    return new Map<string, Category>(categories.map(c => [c._id, c]));
  }, [categories]);

  // Product Selection helpers with SKU-first relevance scoring
  const filteredProductsForManual = React.useMemo(() => {
    if (!productSearch.trim()) return allProducts.slice(0, 15);
    
    return allProducts
      .map(p => ({
        product: p,
        score: calculateProductRelevanceScore(p, productSearch, categoryMap).score
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.product)
      .slice(0, 20);
  }, [allProducts, productSearch, categoryMap]);

  const handleAddProductToManual = (pid: string) => {
    if (!selectedProductIds.includes(pid)) {
      setSelectedProductIds([...selectedProductIds, pid]);
    }
  };

  const handleRemoveProductFromManual = (pid: string) => {
    setSelectedProductIds(selectedProductIds.filter(id => id !== pid));
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { field: "tag", operator: "equals", value: "" }]);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length === 1) return;
    const next = [...conditions];
    next.splice(index, 1);
    setConditions(next);
  };

  const handleConditionChange = (index: number, key: keyof CollectionCondition, value: string) => {
    const next = [...conditions];
    next[index] = {
      ...next[index],
      [key]: value
    };
    setConditions(next);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background/50 backdrop-blur border border-border/80 rounded-2xl p-6 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Layers className="h-8 w-8 text-primary" />
            Collection Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Group products into curated marketing segments or automated rule-based collections.
          </p>
        </div>
        {activeTab === "list" && (
          <Button onClick={handleCreateClick} className="font-bold flex items-center gap-1.5 shadow-md">
            <Plus className="h-4.5 w-4.5" />
            Create Collection
          </Button>
        )}
      </div>

      {activeTab === "list" ? (
        <Card className="border border-border/80 rounded-2xl overflow-hidden shadow-sm bg-card">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-bold">All Collections</CardTitle>
                <CardDescription>Drag and order collections to control their sorting layout in the B2B Mega Menu.</CardDescription>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search collections..." 
                    value={listSearch}
                    onChange={(e) => { setListSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-9 text-sm h-10 w-full"
                  />
                </div>
                <select
                  value={listTypeFilter}
                  onChange={(e) => { setListTypeFilter(e.target.value as any); setCurrentPage(1); }}
                  className="bg-background border rounded-lg px-3 py-1.5 text-sm h-10 font-medium focus:ring-2 focus:ring-primary/50 text-foreground"
                >
                  <option value="all">All Types</option>
                  <option value="manual">Manual</option>
                  <option value="smart">Smart (Automated)</option>
                </select>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {paginatedCollections.length === 0 ? (
              <div className="text-center py-20 bg-secondary/5 border-b">
                <Layers className="h-12 w-12 mx-auto text-muted-foreground/60 mb-3" />
                <p className="font-bold text-foreground">No Collections Found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Get started by creating your first wholesale catalog collection.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm text-foreground">
                  <thead>
                    <tr className="border-b bg-muted/10 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                      <th className="py-4 px-6 w-16">Thumbnail</th>
                      <th className="py-4 px-6">Title</th>
                      <th className="py-4 px-6">Type</th>
                      <th className="py-4 px-6">Order</th>
                      <th className="py-4 px-6">Featured</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedCollections.map((col) => (
                      <tr key={col._id} className="hover:bg-muted/15 transition-colors group">
                        <td className="py-4 px-6">
                          <div className="h-10 w-10 relative rounded-md overflow-hidden bg-secondary border border-border">
                            {col.image ? (
                              <img src={col.image} alt={col.title} className="object-cover h-full w-full" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-muted-foreground/75">
                                <ImageIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-semibold">
                          <div className="flex flex-col">
                            <span className="text-foreground font-bold hover:text-primary transition-colors cursor-pointer" onClick={() => handleEditClick(col)}>
                              {col.title}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium select-all">/{col.slug}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <Badge variant={col.type === "smart" ? "default" : "outline"} className="capitalize font-bold text-[10px]">
                            {col.type}
                          </Badge>
                        </td>
                        <td className="py-4 px-6 font-bold text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">{col.order}</span>
                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={async () => {
                                  await updateCollection(col._id, { order: Math.max(0, (col.order || 0) - 1) });
                                }}
                                className="hover:text-primary p-0.5"
                                title="Move Up"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button 
                                onClick={async () => {
                                  await updateCollection(col._id, { order: (col.order || 0) + 1 });
                                }}
                                className="hover:text-primary p-0.5"
                                title="Move Down"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <button onClick={() => handleToggleFeatured(col)} className="focus:outline-none">
                            <Star className={`h-5 w-5 transition-colors cursor-pointer ${col.isFeatured ? "text-amber-500 fill-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"}`} />
                          </button>
                        </td>
                        <td className="py-4 px-6">
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={col.isActive}
                              onChange={() => handleToggleActive(col)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                          </label>
                        </td>
                        <td className="py-4 px-6 text-right space-x-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(col)} title="Edit collection" className="hover:bg-secondary">
                            <Edit className="h-4.5 w-4.5 text-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(col)} title="Delete collection" className="hover:bg-destructive/10 text-destructive">
                            <Trash2 className="h-4.5 w-4.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t flex justify-end">
                <Pagination 
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredCollections.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Main Card for edit/create */}
          <Card className="border border-border/80 rounded-2xl overflow-hidden shadow-sm bg-card">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Layers className="h-5.5 w-5.5 text-primary" />
                    {editCollectionId ? `Edit Collection: ${title}` : "New Collection"}
                  </CardTitle>
                  <CardDescription>Setup metadata, product associations, rules, categories, and SEO settings.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button type="button" variant="outline" onClick={handleCancelClick} className="font-bold flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button type="submit" className="font-bold flex-1 sm:flex-none flex items-center justify-center gap-1.5 shadow-md">
                    <Save className="h-4.5 w-4.5" />
                    Save Collection
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Sub Tabs Navigation */}
            <div className="flex border-b overflow-x-auto scrollbar-none bg-muted/5">
              <button
                type="button"
                onClick={() => setFormSubTab("general")}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${formSubTab === "general" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Settings className="h-4 w-4" />
                General Details
              </button>
              {type === "manual" && (
                <button
                  type="button"
                  onClick={() => setFormSubTab("products")}
                  className={`py-3.5 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${formSubTab === "products" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <Layers className="h-4 w-4" />
                  Manual Products ({selectedProductIds.length})
                </button>
              )}
              {type === "smart" && (
                <button
                  type="button"
                  onClick={() => setFormSubTab("rules")}
                  className={`py-3.5 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${formSubTab === "rules" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  <Filter className="h-4 w-4" />
                  Smart Rules ({conditions.filter(c => c.value).length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFormSubTab("categories")}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${formSubTab === "categories" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Plus className="h-4 w-4" />
                Linked Categories ({linkedCategoryIds.length})
              </button>
              <button
                type="button"
                onClick={() => setFormSubTab("seo")}
                className={`py-3.5 px-6 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${formSubTab === "seo" ? "border-primary text-primary bg-background" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                <Globe className="h-4 w-4" />
                SEO Optimization
              </button>
            </div>

            <CardContent className="p-6 md:p-8">
              {/* SUB TAB: GENERAL DETAILS */}
              {formSubTab === "general" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Inputs */}
                  <div className="md:col-span-2 space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">Title *</label>
                      <Input
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          if (!editCollectionId) {
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                          }
                        }}
                        placeholder="e.g. Summer Monsoon Sale"
                        required
                        className="text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">Slug *</label>
                      <Input
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="e.g. summer-monsoon-sale"
                        required
                        className="text-foreground"
                      />
                      <span className="text-[10px] text-muted-foreground mt-0.5 block font-medium">Relative URL path: /collections/{slug || "slug-path"}</span>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary or marketing copy for this collection..."
                        rows={4}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-1">Collection Type</label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as any)}
                          disabled={!!editCollectionId}
                          className="w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground font-medium focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                        >
                          <option value="manual">Manual (Hand-pick items)</option>
                          <option value="smart">Smart (Automated by rules)</option>
                        </select>
                        {editCollectionId && (
                          <span className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 text-amber-500" /> Collection type cannot be changed after creation.
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-foreground mb-1">Display Order</label>
                        <Input
                          type="number"
                          value={order}
                          onChange={(e) => setOrder(Number(e.target.value))}
                          placeholder="0"
                          className="text-foreground"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 pt-3">
                      <label className="flex items-center gap-2.5 font-semibold text-sm cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        Active Status
                      </label>
                      <label className="flex items-center gap-2.5 font-semibold text-sm cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={isFeatured}
                          onChange={(e) => setIsFeatured(e.target.checked)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                        />
                        Featured Collection
                      </label>
                    </div>
                  </div>

                  {/* Images Upload */}
                  <div className="space-y-6">
                    {/* Thumbnail Image */}
                    <div className="border rounded-2xl p-5 bg-secondary/5 border-border/80">
                      <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-1">
                        <ImageIcon className="h-4 w-4 text-primary" /> Thumbnail Image
                      </label>
                      <div className="aspect-square bg-secondary rounded-lg overflow-hidden border border-border flex items-center justify-center mb-3 relative group">
                        {image ? (
                          <>
                            <img src={image} alt="Thumbnail preview" className="object-cover h-full w-full" />
                            <button
                              type="button"
                              onClick={() => setImage("")}
                              className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                            <span className="text-xs text-muted-foreground">No image uploaded</span>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="thumbnail-upload" 
                          onChange={(e) => handleImageUpload(e, "thumbnail")}
                          className="hidden" 
                        />
                        <label 
                          htmlFor="thumbnail-upload"
                          className="w-full border rounded-lg bg-background text-xs font-bold text-foreground py-2 px-3 hover:bg-secondary/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          Upload Image
                        </label>
                      </div>
                    </div>

                    {/* Banner Image */}
                    <div className="border rounded-2xl p-5 bg-secondary/5 border-border/80">
                      <label className="block text-sm font-bold text-foreground mb-2 flex items-center gap-1">
                        <ImageIcon className="h-4 w-4 text-primary" /> Banner Image (Hero)
                      </label>
                      <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border flex items-center justify-center mb-3 relative group">
                        {bannerImage ? (
                          <>
                            <img src={bannerImage} alt="Banner preview" className="object-cover h-full w-full" />
                            <button
                              type="button"
                              onClick={() => setBannerImage("")}
                              className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <div className="text-center p-4">
                            <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                            <span className="text-xs text-muted-foreground">No banner uploaded</span>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*" 
                          id="banner-upload" 
                          onChange={(e) => handleImageUpload(e, "banner")}
                          className="hidden" 
                        />
                        <label 
                          htmlFor="banner-upload"
                          className="w-full border rounded-lg bg-background text-xs font-bold text-foreground py-2 px-3 hover:bg-secondary/50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          Upload Banner
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: MANUAL PRODUCTS SELECTION */}
              {formSubTab === "products" && type === "manual" && (
                <div className="space-y-6">
                  {/* Selector panel */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Add products picker */}
                    <div className="lg:col-span-2 border border-border/80 rounded-2xl p-5 bg-secondary/5 space-y-4">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">Select Products to Add</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Search catalog and click add.</p>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search SKU, name, HSN..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="pl-9 h-10 text-foreground"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsSearchPickerOpen(true)}
                          className="h-10 text-xs font-bold shrink-0 border-primary/40 text-primary hover:bg-primary/10"
                        >
                          <Search className="h-3.5 w-3.5 mr-1" /> Browse SKUs
                        </Button>
                      </div>

                      <div className="divide-y max-h-96 overflow-y-auto pr-1">
                        {filteredProductsForManual.map(product => {
                          const isAlreadyAdded = selectedProductIds.includes(product._id);
                          return (
                            <div key={product._id} className="py-2.5 flex justify-between items-center gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 bg-secondary rounded border overflow-hidden flex-shrink-0">
                                  {product.colorVariants?.[0]?.images?.[0] ? (
                                    <img 
                                      src={typeof product.colorVariants[0].images[0] === 'string' ? product.colorVariants[0].images[0] : (product.colorVariants[0].images[0] as any).url} 
                                      alt="" 
                                      className="object-cover h-full w-full"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-3.5 w-3.5" /></div>
                                  )}
                                </div>
                                <div className="text-xs font-bold truncate text-foreground">{product.title}</div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={isAlreadyAdded ? "ghost" : "outline"}
                                disabled={isAlreadyAdded}
                                onClick={() => handleAddProductToManual(product._id)}
                                className="h-7 text-[10px] font-bold shrink-0"
                              >
                                {isAlreadyAdded ? "Added" : "Add"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Selected products grid */}
                    <div className="lg:col-span-3 border border-border/80 rounded-2xl p-5 space-y-4">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">Added Products ({selectedProductIds.length})</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">List of items grouped in this manual collection.</p>
                      </div>

                      {selectedProductIds.length === 0 ? (
                        <div className="text-center py-16 bg-muted/10 rounded-xl">
                          <Layers className="h-10 w-10 text-muted-foreground/60 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No products selected yet. Use the sidebar to add products.</p>
                        </div>
                      ) : (
                        <div className="divide-y max-h-96 overflow-y-auto">
                          {selectedProductIds.map((pid, idx) => {
                            const product = allProducts.find(p => p._id === pid);
                            if (!product) return null;
                            return (
                              <div key={pid} className="py-2.5 flex justify-between items-center gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}</span>
                                  <div className="h-8 w-8 bg-secondary rounded border overflow-hidden flex-shrink-0">
                                    {product.colorVariants?.[0]?.images?.[0] ? (
                                      <img 
                                        src={typeof product.colorVariants[0].images[0] === 'string' ? product.colorVariants[0].images[0] : (product.colorVariants[0].images[0] as any).url} 
                                        alt="" 
                                        className="object-cover h-full w-full"
                                      />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-3.5 w-3.5" /></div>
                                    )}
                                  </div>
                                  <div className="text-xs font-bold truncate text-foreground">{product.title}</div>
                                </div>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRemoveProductFromManual(pid)}
                                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: SMART RULES CONDITION BUILDER */}
              {formSubTab === "rules" && type === "smart" && (
                <div className="space-y-6">
                  {/* Rules builder */}
                  <div className="border border-border/80 rounded-2xl p-5 md:p-6 bg-secondary/5 space-y-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">Automation Query Rules</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Determine which products will be automatically listed in this collection.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Match Products matching:</span>
                        <select
                          value={matchType}
                          onChange={(e) => setMatchType(e.target.value as any)}
                          className="bg-background border rounded px-2.5 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/50"
                        >
                          <option value="all">ALL Conditions (AND)</option>
                          <option value="any">ANY Condition (OR)</option>
                        </select>
                      </div>
                    </div>

                    {/* Condition rows */}
                    <div className="space-y-3">
                      {conditions.map((cond, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center bg-background p-3 rounded-lg border">
                          <select
                            value={cond.field}
                            onChange={(e) => handleConditionChange(idx, "field", e.target.value as any)}
                            className="bg-secondary/50 border rounded px-2 py-1.5 text-xs font-bold text-foreground"
                          >
                            <option value="tag">Product Tag</option>
                            <option value="category">Category ID</option>
                            <option value="price">Product Price (B2C)</option>
                            <option value="title">Product Title</option>
                            <option value="stock">Total Stock</option>
                            <option value="vendor">Vendor ID</option>
                          </select>

                          <select
                            value={cond.operator}
                            onChange={(e) => handleConditionChange(idx, "operator", e.target.value as any)}
                            className="bg-secondary/50 border rounded px-2 py-1.5 text-xs font-bold text-foreground"
                          >
                            <option value="equals">is equal to</option>
                            <option value="not_equals">is not equal to</option>
                            <option value="contains">contains</option>
                            <option value="starts_with">starts with</option>
                            <option value="greater_than">is greater than</option>
                            <option value="less_than">is less than</option>
                          </select>

                          <Input
                            placeholder="Condition value..."
                            value={cond.value}
                            onChange={(e) => handleConditionChange(idx, "value", e.target.value)}
                            className="h-8 text-xs font-medium flex-1 text-foreground"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={conditions.length === 1}
                            onClick={() => handleRemoveCondition(idx)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0 self-end sm:self-auto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddCondition}
                      className="font-bold flex items-center gap-1 h-8 text-xs"
                    >
                      <Plus className="h-4 w-4" /> Add condition
                    </Button>
                  </div>

                  {/* Matching Preview results */}
                  <div className="border border-border/80 rounded-2xl p-5 md:p-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                          <Eye className="h-4 w-4 text-primary" /> Live Rules Match Preview
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Matching catalog products matching the rules above.</p>
                      </div>
                      <Badge variant="outline" className="font-extrabold text-[10px]">
                        {isPreviewLoading ? "Evaluating..." : `${previewProducts.length} matched`}
                      </Badge>
                    </div>

                    {isPreviewLoading ? (
                      <div className="text-center py-10 bg-secondary/5 rounded-xl text-xs text-muted-foreground">Evaluating rule matches...</div>
                    ) : previewProducts.length === 0 ? (
                      <div className="text-center py-10 bg-secondary/5 rounded-xl">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/60 mx-auto mb-1.5" />
                        <p className="text-xs font-bold text-foreground">No Matching Products</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Adjust rule values or field types to query catalog items.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1.5">
                        {previewProducts.map(product => (
                          <div key={product._id} className="p-2.5 rounded-lg border bg-secondary/10 flex items-center gap-2.5 text-xs font-bold">
                            <div className="h-8 w-8 bg-secondary border rounded overflow-hidden flex-shrink-0">
                              {product.colorVariants?.[0]?.images?.[0] ? (
                                <img 
                                  src={typeof product.colorVariants[0].images[0] === 'string' ? product.colorVariants[0].images[0] : (product.colorVariants[0].images[0] as any).url} 
                                  alt="" 
                                  className="object-cover h-full w-full"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-3 w-3" /></div>
                              )}
                            </div>
                            <span className="truncate flex-1 text-foreground">{product.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB TAB: LINKED CATEGORIES */}
              {formSubTab === "categories" && (
                <div className="border border-border/80 rounded-2xl p-5 md:p-6 bg-secondary/5 space-y-4">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">Link Categories for Dropdown Nav</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Select which catalog categories and sub-categories are grouped under this collection in the public header Mega Menu.</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto pt-2">
                    {categories.map((cat) => {
                      const isLinked = linkedCategoryIds.includes(cat._id);
                      return (
                        <button
                          key={cat._id}
                          type="button"
                          onClick={() => {
                            if (isLinked) {
                              setLinkedCategoryIds(linkedCategoryIds.filter(id => id !== cat._id));
                            } else {
                              setLinkedCategoryIds([...linkedCategoryIds, cat._id]);
                            }
                          }}
                          className={`p-3 border rounded-xl text-xs font-bold text-left transition-all relative flex items-center justify-between ${isLinked ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border hover:border-primary/50 text-foreground"}`}
                        >
                          <span className="truncate mr-2">{cat.name}</span>
                          {isLinked ? (
                            <Check className="h-4.5 w-4.5 text-primary shrink-0" />
                          ) : (
                            <span className="w-4 h-4 border border-muted-foreground/35 rounded-full shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB TAB: SEO DETAILS */}
              {formSubTab === "seo" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Inputs */}
                  <div className="lg:col-span-2 space-y-5">
                    <div>
                      <h3 className="font-bold text-sm text-foreground">SEO Search Optimization</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Enhance listing page visibility across Search Engines (Google, Bing).</p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">SEO Page Title</label>
                      <Input
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder={title || "Collection Meta Title"}
                        className="text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">SEO Meta Description</label>
                      <textarea
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        placeholder="Page meta description details..."
                        rows={3}
                        className="w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-foreground mb-1">SEO Keywords</label>
                      <Input
                        value={seoKeywords}
                        onChange={(e) => setSeoKeywords(e.target.value)}
                        placeholder="e.g. bulk buying, wholesale goods, electronics monsoon sale"
                        className="text-foreground"
                      />
                    </div>
                  </div>

                  {/* Live preview snippets */}
                  <div className="border border-border/80 rounded-2xl p-5 bg-secondary/5 space-y-4 h-fit">
                    <label className="block text-sm font-bold text-foreground mb-1 flex items-center gap-1">
                      <Globe className="h-4 w-4 text-primary" /> Google SERP Snippet Preview
                    </label>
                    <div className="space-y-1.5 font-sans bg-background border p-4 rounded-xl shadow-inner select-none">
                      <div className="text-[10px] text-[#202124] truncate flex items-center gap-1 font-medium">
                        <span>https://flexsell.wholesale/collections/{slug || "slug-path"}</span>
                      </div>
                      <div className="text-lg text-[#1a0dab] font-medium leading-tight line-clamp-1 hover:underline cursor-pointer">
                        {seoTitle || title || "Collection Title | Wholesale Portal"}
                      </div>
                      <div className="text-xs text-[#4d5156] leading-relaxed line-clamp-2">
                        {seoDescription || description || "Shop bulk products online at wholesale prices. Flexible pricing tiers and fast cargo deliveries."}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}

      {/* Product SKU Picker Modal */}
      <ProductSearchPicker
        isOpen={isSearchPickerOpen}
        onClose={() => setIsSearchPickerOpen(false)}
        onSelectProduct={(p) => handleAddProductToManual(p._id)}
        selectedProductIds={selectedProductIds}
        multiSelect
        title="Select Products for Collection by SKU or Name"
      />
    </div>
  );
}
