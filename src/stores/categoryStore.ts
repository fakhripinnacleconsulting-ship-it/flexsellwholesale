import { create } from "zustand";
import { Category } from "@/types";
import { categoryService } from "@/services/categoryService";
import { handleApiError } from "@/lib/apiClient";

interface CategoryStoreState {
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  initializeCategories: (initial?: Category[]) => Promise<void>;
  addCategory: (category: Omit<Category, "_id" | "createdAt">) => Promise<void>;
  updateCategory: (id: string, updatedFields: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryStoreState>()((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,

  initializeCategories: async (initial) => {
    if (initial && initial.length > 0) {
      set({ categories: initial, isLoading: false });
      return;
    }
    if (get().categories.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const data = await categoryService.getCategories();
      set({ categories: data, isLoading: false });
    } catch (err) {
      set({ 
        categories: initial || [], 
        error: handleApiError(err, "Failed to load categories"), 
        isLoading: false 
      });
    }
  },

  addCategory: async (categoryData) => {
    set({ isLoading: true, error: null });
    try {
      const newCategory = await categoryService.createCategory(categoryData);
      set((state) => ({
        categories: [...state.categories, newCategory],
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to add category"),
        isLoading: false
      });
      throw err;
    }
  },

  updateCategory: async (id, updatedFields) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCategory = await categoryService.updateCategory(id, updatedFields);
      set((state) => ({
        categories: state.categories.map(c => c._id === id ? updatedCategory : c),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to update category"),
        isLoading: false
      });
      throw err;
    }
  },

  deleteCategory: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await categoryService.deleteCategory(id);
      set((state) => ({
        categories: state.categories.filter(c => c._id !== id),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to delete category"),
        isLoading: false
      });
      throw err;
    }
  }
}));
