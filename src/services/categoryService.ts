import { Category } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";

const CATEGORIES_STORAGE_KEY = "flexsell-categories-storage";

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    if (typeof window !== "undefined" && isMockMode) {
      try {
        const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    try {
      const data = await apiClient.get<Category[]>("/categories");
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
          if (raw) return JSON.parse(raw);
        } catch {}
      }
      console.warn("Failed to fetch categories from API, returning fallback:", err);
      return [];
    }
  },

  async createCategory(
    categoryData: Omit<Category, "_id" | "createdAt">
  ): Promise<Category> {
    if (typeof window !== "undefined" && isMockMode) {
      const randomObjectId = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const newCat: Category = {
        ...categoryData,
        _id: randomObjectId,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      try {
        const current = await this.getCategories();
        const updated = [...current, newCat];
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return newCat;
    }
    return apiClient.post<Category>("/categories", categoryData);
  },

  async updateCategory(
    id: string,
    updatedFields: Partial<Category>
  ): Promise<Category> {
    if (typeof window !== "undefined" && isMockMode) {
      let updatedCat: any = null;
      try {
        const current = await this.getCategories();
        const updated = current.map((c) => {
          if (c._id === id) {
            updatedCat = { ...c, ...updatedFields };
            return updatedCat;
          }
          return c;
        });
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      if (!updatedCat) throw new Error("Category not found");
      return updatedCat;
    }
    return apiClient.put<Category>(`/categories/${id}`, updatedFields);
  },

  async deleteCategory(id: string): Promise<void> {
    if (typeof window !== "undefined" && isMockMode) {
      try {
        const current = await this.getCategories();
        const updated = current.filter((c) => c._id !== id);
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(updated));
      } catch {}
      return;
    }
    return apiClient.delete<void>(`/categories/${id}`);
  },
};
