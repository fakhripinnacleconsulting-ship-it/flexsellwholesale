import { cache } from "react";
import { Product } from "@/types";
import { apiClient } from "@/lib/apiClient";

const fetchProductBySlug = cache(async (slug: string): Promise<Product> => {
  if (typeof window === "undefined") {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const ProductModel = (await import("@/models/Product")).default;
    const product = await ProductModel.findOne({ slug }).lean();
    if (!product) throw new Error("Product not found");
    return JSON.parse(JSON.stringify(product));
  }
  return apiClient.get<Product>(`/products/slug/${slug}`);
});

const fetchTrendingProducts = cache(async (): Promise<Product[]> => {
  if (typeof window !== "undefined") return [];
  try {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const ProductModel = (await import("@/models/Product")).default;
    const CategoryModel = (await import("@/models/Category")).default;
    const OrderModel = (await import("@/models/Order")).default;

    let productQuery = ProductModel.find({ isActive: true }).sort({ createdAt: -1 }).limit(24);
    let orderQuery = OrderModel.find({ status: { $ne: "Cancelled" } }).sort({ createdAt: -1 }).select("items").limit(20);

    const [categories, products, orders] = await Promise.all([
      CategoryModel.find({ isActive: true }).select("_id").lean(),
      productQuery.lean(),
      orderQuery.lean()
    ]);

    const categoryIds = categories.map(c => c._id);
    const salesMap: Record<string, number> = {};
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const productId = item.productId || item.product?._id || (typeof item.product === "string" ? item.product : undefined);
          if (productId) {
            salesMap[productId] = (salesMap[productId] || 0) + (Number(item.quantity) || 0);
          }
        }
      }
    }

    const categoryProducts: Record<string, typeof products> = {};
    for (const product of products) {
      const catId = product.categoryId;
      if (!categoryProducts[catId]) categoryProducts[catId] = [];
      categoryProducts[catId].push(product);
    }

    const trendingProducts: typeof products = [];
    const addedProductIds = new Set<string>();

    for (const catId of categoryIds) {
      const catProds = categoryProducts[catId] || [];
      if (catProds.length === 0) continue;
      catProds.sort((a, b) => {
        const salesA = salesMap[a._id] || 0;
        const salesB = salesMap[b._id] || 0;
        if (salesA !== salesB) return salesB - salesA;
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      if (catProds[0]) {
        trendingProducts.push(catProds[0]);
        addedProductIds.add(catProds[0]._id);
      }
    }

    for (const product of products) {
      if (!addedProductIds.has(product._id)) {
        const sales = salesMap[product._id] || 0;
        if (sales > 0) {
          trendingProducts.push(product);
          addedProductIds.add(product._id);
        }
      }
    }

    trendingProducts.sort((a, b) => {
      const salesA = salesMap[a._id] || 0;
      const salesB = salesMap[b._id] || 0;
      if (salesA !== salesB) return salesB - salesA;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return JSON.parse(JSON.stringify(trendingProducts.slice(0, 12)));
  } catch (err) {
    console.error("fetchTrendingProducts cache notice:", (err as any)?.message || err);
    return [];
  }
});

const fetchNewArrivals = cache(async (): Promise<Product[]> => {
  if (typeof window !== "undefined") return [];
  try {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const ProductModel = (await import("@/models/Product")).default;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const products = await ProductModel.find({
      isActive: true,
      createdAt: { $gte: cutoffDate }
    }).sort({ createdAt: -1 }).limit(10).lean();

    return JSON.parse(JSON.stringify(products));
  } catch (err) {
    console.error("fetchNewArrivals cache notice:", (err as any)?.message || err);
    return [];
  }
});

export const productService = {
  async getProducts(options?: { limit?: number }): Promise<Product[]> {
    if (typeof window === "undefined") {
      try {
        const dbConnect = (await import("@/lib/dbConnect")).default;
        await dbConnect();
        const ProductModel = (await import("@/models/Product")).default;
        let query = ProductModel.find({}).sort({ createdAt: -1 });
        if (options?.limit) {
          query = query.limit(options.limit);
        }
        const products = await query.lean();
        return JSON.parse(JSON.stringify(products));
      } catch (err) {
        console.error("productService.getProducts server notice:", (err as any)?.message || err);
        return [];
      }
    }
    
    const url = options?.limit ? `/products?limit=${options.limit}` : "/products";
    return apiClient.get<Product[]>(url);
  },

  async getProductById(id: string): Promise<Product> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      const product = await ProductModel.findById(id).lean();
      if (!product) throw new Error("Product not found");
      return JSON.parse(JSON.stringify(product));
    }
    return apiClient.get<Product>(`/products/${id}`);
  },

  getProductBySlug(slug: string): Promise<Product> {
    return fetchProductBySlug(slug);
  },

  async createProduct(
    productData: Omit<Product, "_id" | "createdAt">
  ): Promise<Product> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      const randomObjectId = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const product = await ProductModel.create({
        ...productData,
        _id: randomObjectId,
        isActive: true
      });
      return JSON.parse(JSON.stringify(product));
    }
    return apiClient.post<Product>("/products", productData);
  },

  async updateProduct(
    id: string,
    updatedFields: Partial<Product>
  ): Promise<Product> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      const product = await ProductModel.findByIdAndUpdate(
        id,
        { $set: updatedFields },
        { new: true }
      ).lean();
      if (!product) throw new Error("Product not found");
      return JSON.parse(JSON.stringify(product));
    }
    return apiClient.put<Product>(`/products/${id}`, updatedFields);
  },

  async deleteProduct(id: string): Promise<void> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      await ProductModel.findByIdAndDelete(id);
      return;
    }
    return apiClient.delete<void>(`/products/${id}`);
  },

  async bulkDeleteProducts(ids: string[]): Promise<void> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      await ProductModel.deleteMany({ _id: { $in: ids } });
      return;
    }
    return apiClient.delete<void>("/products/bulk", {
      body: JSON.stringify({ ids }),
      headers: { "Content-Type": "application/json" }
    });
  },

  async getTrendingProducts(): Promise<Product[]> {
    if (typeof window === "undefined") {
      return fetchTrendingProducts();
    }

    return apiClient.get<Product[]>("/products/trending");
  },

  async getNewArrivals(): Promise<Product[]> {
    if (typeof window === "undefined") {
      return fetchNewArrivals();
    }

    return apiClient.get<Product[]>("/products/new-arrivals");
  },
};
