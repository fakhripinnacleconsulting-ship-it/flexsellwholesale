"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Plus, Edit2, Check, X, Search, MoreVertical, Ban, Tag } from "lucide-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";

interface Category {
  _id: string;
  key: string;
  label: string;
  colour: string;
  sortOrder: number;
  isActive: boolean;
}

export default function ExpenseCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { addToast } = useToastStore();

  const [isAddMode, setIsAddMode] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newColour, setNewColour] = useState("#64748b");
  const [newSortOrder, setNewSortOrder] = useState<number>(500);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColour, setEditColour] = useState("");
  const [editSortOrder, setEditSortOrder] = useState<number>(500);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await apiClient.get<Category[]>("/advance-balance/categories?includeInactive=1");
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey || !newLabel) {
      addToast("Key and label are required", "error");
      return;
    }
    
    try {
      const created = await apiClient.post<Category>("/advance-balance/categories", {
        key: newKey,
        label: newLabel,
        colour: newColour,
        sortOrder: Number(newSortOrder),
      });
      setCategories([...categories, { ...created, isActive: true, colour: newColour, sortOrder: newSortOrder }]);
      setIsAddMode(false);
      setNewKey("");
      setNewLabel("");
      addToast("Category added", "success");
      fetchCategories();
    } catch (err: any) {
      addToast(err.message || "Failed to add category", "error");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingKey(cat.key);
    setEditLabel(cat.label);
    setEditColour(cat.colour);
    setEditSortOrder(cat.sortOrder || 500);
    setEditIsActive(cat.isActive);
  };

  const handleEditSubmit = async (key: string) => {
    if (!editLabel.trim()) {
      addToast("Label is required", "error");
      return;
    }

    try {
      const updated = await apiClient.patch<Category>("/advance-balance/categories", {
        key,
        label: editLabel,
        colour: editColour,
        sortOrder: Number(editSortOrder),
        isActive: editIsActive,
      });

      setCategories(categories.map(c => c.key === key ? { ...c, label: updated.label, colour: editColour, sortOrder: editSortOrder, isActive: updated.isActive } : c));
      setEditingKey(null);
      addToast("Category updated", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update category", "error");
    }
  };

  const toggleActiveStatus = async (cat: Category) => {
    try {
      const updated = await apiClient.patch<Category>("/advance-balance/categories", {
        key: cat.key,
        isActive: !cat.isActive,
      });
      setCategories(categories.map(c => c.key === cat.key ? { ...c, isActive: updated.isActive } : c));
      addToast(`Category ${updated.isActive ? 'activated' : 'deactivated'}`, "success");
    } catch (err: any) {
      addToast(err.message || "Failed to toggle status", "error");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage categories used for grouping Advance Balance expenses.
          </p>
        </div>
        <button 
          onClick={() => setIsAddMode(!isAddMode)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors"
        >
          {isAddMode ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAddMode ? "Cancel" : "Add Category"}
        </button>
      </div>

      {error && (
        <ErrorState title="Failed to load categories" description={error} onRetry={fetchCategories} className="border-0 bg-transparent py-4" />
      )}

      {isAddMode && (
        <form onSubmit={handleAddSubmit} className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-4">
          <h3 className="text-sm font-semibold mb-2">New Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Key (immutable)</label>
              <input 
                type="text" 
                value={newKey} 
                onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. facebook_ads"
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Label</label>
              <input 
                type="text" 
                value={newLabel} 
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Facebook Ads"
                className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Color</label>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={newColour} 
                  onChange={e => setNewColour(e.target.value)}
                  className="h-9 w-12 rounded-md cursor-pointer border border-input p-0"
                />
                <input 
                  type="text" 
                  value={newColour} 
                  onChange={e => setNewColour(e.target.value)}
                  className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono uppercase"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Sort Order</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={newSortOrder} 
                  onChange={e => setNewSortOrder(Number(e.target.value))}
                  className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90">
                  Save
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Tag className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p>No expense categories found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {categories.map((cat) => (
                <div key={cat.key} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:bg-muted/30 ${!cat.isActive ? 'opacity-60' : ''}`}>
                  {editingKey === cat.key ? (
                    // Edit Mode
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-3">
                        <span className="text-xs font-mono text-muted-foreground block mb-1">Key (Immutable)</span>
                        <div className="text-sm font-medium opacity-70 px-3 py-2 bg-muted rounded-md">{cat.key}</div>
                      </div>
                      <div className="sm:col-span-4">
                        <span className="text-xs font-mono text-muted-foreground block mb-1">Label</span>
                        <input 
                          type="text" 
                          value={editLabel} 
                          onChange={e => setEditLabel(e.target.value)}
                          className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-mono text-muted-foreground block mb-1">Color</span>
                        <input 
                          type="color" 
                          value={editColour} 
                          onChange={e => setEditColour(e.target.value)}
                          className="h-9 w-full rounded-md cursor-pointer border border-input p-0"
                        />
                      </div>
                      <div className="sm:col-span-3 flex items-end gap-2">
                        <div className="w-full">
                          <span className="text-xs font-mono text-muted-foreground block mb-1">Sort</span>
                          <input 
                            type="number" 
                            value={editSortOrder} 
                            onChange={e => setEditSortOrder(Number(e.target.value))}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex gap-1 pb-[1px]">
                          <button onClick={() => handleEditSubmit(cat.key)} className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded hover:bg-emerald-200 transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingKey(null)} className="p-2 bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-4 h-8 rounded-full flex-shrink-0 shadow-inner" 
                          style={{ backgroundColor: cat.colour }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{cat.label}</h3>
                            {!cat.isActive && (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground">Inactive</span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">key: {cat.key} • sort: {cat.sortOrder}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => toggleActiveStatus(cat)}
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          title={cat.isActive ? "Deactivate" : "Activate"}
                        >
                          {cat.isActive ? <Ban className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => startEdit(cat)}
                          className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
