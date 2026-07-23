import { Collection, Product, CollectionCondition, CollectionRules } from "@/types";
import { apiClient, isMockMode } from "@/lib/apiClient";
import { productService } from "./productService";

const STORAGE_KEY = "flexsell-collections-storage";

// Helper to get local mock data
function getLocalCollections(): Collection[] {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    // Return some seed collections if empty
    const seed: Collection[] = [
      {
        _id: "col_1",
        title: "Summer Essentials",
        slug: "summer-essentials",
        description: "Be summer ready with our curated selection of hot items.",
        type: "manual",
        image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80",
        bannerImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        productIds: [],
        isActive: true,
        isFeatured: true,
        order: 1,
        linkedCategoryIds: [],
      },
      {
        _id: "col_2",
        title: "Budget Electronics",
        slug: "budget-electronics",
        description: "Top gadgets and electronics under ₹5,000.",
        type: "smart",
        image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80",
        bannerImage: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80",
        rules: {
          matchType: "all",
          conditions: [
            { field: "price", operator: "less_than", value: "5000" }
          ]
        },
        isActive: true,
        isFeatured: true,
        order: 2,
        linkedCategoryIds: [],
      }
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  return JSON.parse(stored);
}

// Helper to save local mock data
function saveLocalCollections(collections: Collection[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  }
}

// Client-side rule evaluator for smart collections in mock mode
function evaluateSmartRulesInClient(product: Product, rules: CollectionRules | null | undefined): boolean {
  if (!rules || !rules.conditions || rules.conditions.length === 0) return false;
  
  const matchCondition = (cond: CollectionCondition) => {
    let productValue: string | number | string[] = "";
    if (cond.field === "tag") {
      productValue = product.tags || [];
    } else if (cond.field === "category") {
      productValue = product.categoryId;
    } else if (cond.field === "price") {
      const prices = product.colorVariants?.flatMap(cv => cv.subVariants?.map(sv => sv.b2cPrice) || []) || [];
      productValue = prices.length > 0 ? Math.min(...prices) : 0;
    } else if (cond.field === "title") {
      productValue = product.title;
    } else if (cond.field === "stock") {
      productValue = product.totalStock || 0;
    } else if (cond.field === "vendor") {
      productValue = product.vendorId || "";
    }

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

  if (rules.matchType === "any") {
    return rules.conditions.some(matchCondition);
  } else {
    return rules.conditions.every(matchCondition);
  }
}

export const collectionService = {
  async getCollections(): Promise<Collection[]> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const collections = await CollectionModel.find({}).sort({ order: 1 }).lean();
      return JSON.parse(JSON.stringify(collections));
    }

    if (isMockMode) {
      return getLocalCollections().sort((a, b) => a.order - b.order);
    }
    return apiClient.get<Collection[]>("/collections");
  },

  async getCollectionById(id: string): Promise<Collection> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const collection = await CollectionModel.findById(id).lean();
      if (!collection) throw new Error("Collection not found");
      return JSON.parse(JSON.stringify(collection));
    }

    if (isMockMode) {
      const collection = getLocalCollections().find(c => c._id === id);
      if (!collection) throw new Error("Collection not found");
      return collection;
    }
    return apiClient.get<Collection>(`/collections/${id}`);
  },

  async getCollectionBySlug(slug: string): Promise<Collection> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const collection = await CollectionModel.findOne({ slug }).lean();
      if (!collection) throw new Error("Collection not found");
      return JSON.parse(JSON.stringify(collection));
    }

    if (isMockMode) {
      const collection = getLocalCollections().find(c => c.slug === slug);
      if (!collection) throw new Error("Collection not found");
      return collection;
    }
    return apiClient.get<Collection>(`/collections/slug/${slug}`);
  },

  async createCollection(
    collectionData: Omit<Collection, "_id" | "createdAt">
  ): Promise<Collection> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const randomObjectId = "col_" + Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const collection = await CollectionModel.create({
        ...collectionData,
        _id: randomObjectId
      });
      return JSON.parse(JSON.stringify(collection));
    }

    if (isMockMode) {
      const collections = getLocalCollections();
      const defaults = {
        image: "",
        bannerImage: "",
        productIds: [],
        linkedCategoryIds: [],
        isActive: true,
        isFeatured: false,
        order: 0,
      };
      const newCol: Collection = {
        ...defaults,
        ...collectionData,
        _id: "col_" + Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      collections.push(newCol);
      saveLocalCollections(collections);
      return newCol;
    }
    return apiClient.post<Collection>("/collections", collectionData);
  },

  async updateCollection(
    id: string,
    updatedFields: Partial<Collection>
  ): Promise<Collection> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const collection = await CollectionModel.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }
      ).lean();
      if (!collection) throw new Error("Collection not found");
      return JSON.parse(JSON.stringify(collection));
    }

    if (isMockMode) {
      const collections = getLocalCollections();
      const index = collections.findIndex(c => c._id === id);
      if (index === -1) throw new Error("Collection not found");
      collections[index] = {
        ...collections[index],
        ...updatedFields,
        updatedAt: new Date().toISOString()
      };
      saveLocalCollections(collections);
      return collections[index];
    }
    return apiClient.put<Collection>(`/collections/${id}`, updatedFields);
  },

  async deleteCollection(id: string): Promise<void> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      await CollectionModel.findByIdAndDelete(id);
      return;
    }

    if (isMockMode) {
      const collections = getLocalCollections();
      const filtered = collections.filter(c => c._id !== id);
      saveLocalCollections(filtered);
      return;
    }
    return apiClient.delete<void>(`/collections/${id}`);
  },

  async getCollectionProducts(id: string): Promise<Product[]> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const CollectionModel = (await import("@/models/Collection")).default;
      const ProductModel = (await import("@/models/Product")).default;
      
      const collection = await CollectionModel.findById(id).lean();
      if (!collection) throw new Error("Collection not found");

      if (collection.type === "manual") {
        const products = await ProductModel.find({ _id: { $in: collection.productIds || [] } }).lean();
        return JSON.parse(JSON.stringify(products));
      } else {
        // Smart Collection Query Construction
        const rules = collection.rules;
        if (!rules || !rules.conditions || rules.conditions.length === 0) {
          return [];
        }

        const buildConditionQuery = (cond: CollectionCondition) => {
          let queryField = "";
          if (cond.field === "tag") queryField = "tags";
          else if (cond.field === "category") queryField = "categoryId";
          else if (cond.field === "price") queryField = "colorVariants.subVariants.b2cPrice";
          else if (cond.field === "title") queryField = "title";
          else if (cond.field === "stock") queryField = "totalStock";
          else if (cond.field === "vendor") queryField = "vendorId";

          let val: string | number = cond.value;
          if (cond.field === "price" || cond.field === "stock") {
            val = Number(cond.value);
          }

          switch (cond.operator) {
            case "equals":
              return { [queryField]: val };
            case "not_equals":
              return { [queryField]: { $ne: val } };
            case "contains":
              return { [queryField]: { $regex: val, $options: "i" } };
            case "starts_with":
              return { [queryField]: { $regex: `^${val}`, $options: "i" } };
            case "greater_than":
              return { [queryField]: { $gt: val } };
            case "less_than":
              return { [queryField]: { $lt: val } };
            default:
              return {};
          }
        };

        const conditionQueries = rules.conditions.map(buildConditionQuery);
        let finalQuery = {};
        if (rules.matchType === "any") {
          finalQuery = { $or: conditionQueries };
        } else {
          finalQuery = { $and: conditionQueries };
        }

        // Apply isActive filter so storefront doesn't see inactive products
        finalQuery = { ...finalQuery, isActive: true };

        const products = await ProductModel.find(finalQuery).lean();
        return JSON.parse(JSON.stringify(products));
      }
    }

    if (isMockMode) {
      const collection = getLocalCollections().find(c => c._id === id);
      if (!collection) throw new Error("Collection not found");
      const allProducts = await productService.getProducts();

      if (collection.type === "manual") {
        return allProducts.filter(p => collection.productIds?.includes(p._id));
      } else {
        return allProducts.filter(p => evaluateSmartRulesInClient(p, collection.rules));
      }
    }

    return apiClient.get<Product[]>(`/collections/${id}/products`);
  }
};
