import { Category } from "@/types";
import { apiClient } from "@/lib/apiClient";

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CategoryModel = (await import("@/models/Category")).default;
      const categories = await CategoryModel.find({}).sort({ order: 1 }).lean();
      return JSON.parse(JSON.stringify(categories));
    }
    return apiClient.get<Category[]>("/categories");
  },

  async createCategory(
    categoryData: Omit<Category, "_id" | "createdAt">
  ): Promise<Category> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CategoryModel = (await import("@/models/Category")).default;
      const randomObjectId = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const category = await CategoryModel.create({
        ...categoryData,
        _id: randomObjectId,
        isActive: true
      });
      return JSON.parse(JSON.stringify(category));
    }
    return apiClient.post<Category>("/categories", categoryData);
  },

  async updateCategory(
    id: string,
    updatedFields: Partial<Category>
  ): Promise<Category> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CategoryModel = (await import("@/models/Category")).default;
      const category = await CategoryModel.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }
      ).lean();
      if (!category) throw new Error("Category not found");
      return JSON.parse(JSON.stringify(category));
    }
    return apiClient.put<Category>(`/categories/${id}`, updatedFields);
  },

  async deleteCategory(id: string): Promise<void> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CategoryModel = (await import("@/models/Category")).default;
      await CategoryModel.findByIdAndDelete(id);
      return;
    }
    return apiClient.delete<void>(`/categories/${id}`);
  },
};
