import { Product, Category } from "@/types";
import { apiClient } from "@/lib/apiClient";
import { resolvePrice } from "@/lib/priceTierHelper";

export interface SearchOptions {
  query?: string;
  sku?: string;
  categoryId?: string;
  collectionId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  minDiscount?: number;
  sortBy?: "recommended" | "price-asc" | "price-desc" | "newest" | "relevance";
  page?: number;
  limit?: number;
  isActive?: boolean;
}

export interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
  exactSkuMatch?: {
    product: Product;
    sku: string;
    variantDetails: string;
  } | null;
  categoryFacets: Array<{ categoryId: string; name: string; count: number }>;
  priceRange: { min: number; max: number };
}

export interface SuggestResult {
  products: Array<{
    _id: string;
    title: string;
    slug: string;
    price: number;
    image: string;
    matchedSku?: string;
    stock: number;
    categoryName?: string;
  }>;
  skus: Array<{
    sku: string;
    productId: string;
    productTitle: string;
    slug: string;
    color: string;
    size: string;
    stock: number;
    price: number;
  }>;
  categories: Array<{
    _id: string;
    name: string;
    slug: string;
    count: number;
  }>;
}

/**
 * Calculates a search relevance score for a product given a search query string.
 * Exact SKU / Barcode / Product ID matches receive highest score boost.
 */
export function calculateProductRelevanceScore(
  product: Product,
  queryStr: string,
  categoryMap: Map<string, Category>
): { score: number; matchedSku?: string } {
  const q = queryStr.trim().toLowerCase();
  if (!q) return { score: 0 };

  let score = 0;
  let matchedSku: string | undefined = undefined;

  // 1. Exact Product ID match (+100)
  if (product._id.toLowerCase() === q) {
    score += 100;
  }

  // 2. SKU and Barcode matching (+95 for exact SKU, +75 for partial SKU)
  if (product.colorVariants && Array.isArray(product.colorVariants)) {
    for (const cv of product.colorVariants) {
      if (cv.subVariants && Array.isArray(cv.subVariants)) {
        for (const sv of cv.subVariants) {
          const skuLower = (sv.sku || "").toLowerCase();
          const barcodeLower = (sv.barcode || "").toLowerCase();

          if (skuLower === q || barcodeLower === q) {
            score += 95;
            if (!matchedSku) matchedSku = sv.sku;
          } else if (skuLower.startsWith(q)) {
            score += 75;
            if (!matchedSku) matchedSku = sv.sku;
          } else if (skuLower.includes(q) || barcodeLower.includes(q)) {
            score += 55;
            if (!matchedSku) matchedSku = sv.sku;
          }
        }
      }
    }
  }

  // 3. Title matching (+60 exact, +45 startsWith, +30 includes)
  const titleLower = product.title.toLowerCase();
  if (titleLower === q) {
    score += 60;
  } else if (titleLower.startsWith(q)) {
    score += 45;
  } else if (titleLower.includes(q)) {
    score += 30;
  }

  // 4. Category Name matching (+25)
  const cat = categoryMap.get(product.categoryId);
  if (cat && cat.name.toLowerCase().includes(q)) {
    score += 25;
  }

  // 5. HSN Code (+25)
  if (product.hsnCode && product.hsnCode.toLowerCase().includes(q)) {
    score += 25;
  }

  // 6. Tags & CardTags (+20)
  if (product.tags?.some((t) => t.toLowerCase().includes(q))) {
    score += 20;
  }
  if (product.cardTags?.some((ct) => ct.toLowerCase().includes(q))) {
    score += 15;
  }

  // 7. SEO Keywords & Title (+15)
  if (product.seoKeywords?.toLowerCase().includes(q)) {
    score += 15;
  }

  // 8. Description matching (+10)
  if ((product.description || "").toLowerCase().includes(q)) {
    score += 10;
  }

  return { score, matchedSku };
}

export const searchService = {
  /**
   * Performs full product search with filtering, sorting, facets, and exact SKU detection.
   */
  async searchProducts(options: SearchOptions = {}): Promise<SearchResult> {
    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      const CategoryModel = (await import("@/models/Category")).default;

      const page = options.page || 1;
      const limit = options.limit || 12;
      const skip = (page - 1) * limit;

      const filter: any = {};
      if (options.isActive !== false) {
        filter.isActive = true;
      }
      if (options.categoryId) {
        filter.categoryId = options.categoryId;
      }

      // Fetch categories for mapping
      const allCategories: Category[] = await CategoryModel.find({ isActive: true }).lean();
      const categoryMap = new Map<string, Category>(allCategories.map((c) => [c._id, c]));

      let rawProducts: Product[] = await ProductModel.find(filter).lean();
      rawProducts = JSON.parse(JSON.stringify(rawProducts));

      const queryStr = options.query || options.sku || "";

      // Relevancy & filtering
      let scoredList: Array<{ product: Product; score: number; matchedSku?: string }> = [];

      if (queryStr.trim()) {
        for (const p of rawProducts) {
          const { score, matchedSku } = calculateProductRelevanceScore(p, queryStr, categoryMap);
          if (score > 0) {
            scoredList.push({ product: p, score, matchedSku });
          }
        }
      } else {
        scoredList = rawProducts.map((p) => ({ product: p, score: 1 }));
      }

      // Detect exact SKU match
      let exactSkuMatch: SearchResult["exactSkuMatch"] = null;
      if (queryStr.trim()) {
        const qLower = queryStr.trim().toLowerCase();
        for (const item of scoredList) {
          const p = item.product;
          p.colorVariants?.forEach((cv) => {
            cv.subVariants?.forEach((sv) => {
              if (sv.sku && sv.sku.toLowerCase() === qLower) {
                exactSkuMatch = {
                  product: p,
                  sku: sv.sku,
                  variantDetails: `${cv.color} • ${sv.size || "Std"} • ${sv.weight || "250g"}`,
                };
              }
            });
          });
          if (exactSkuMatch) break;
        }
      }

      // Apply price, stock, and discount sub-filters
      let filtered = scoredList.filter(({ product: p }) => {
        const firstSv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = firstSv ? resolvePrice(firstSv, p.defaultPriceTier || "B2C") : 0;

        if (options.minPrice !== undefined && price < options.minPrice) return false;
        if (options.maxPrice !== undefined && price > options.maxPrice) return false;
        if (options.inStock && p.totalStock <= 0) return false;
        if (options.minDiscount && options.minDiscount > 0) {
          const mrp = firstSv?.mrp ?? 0;
          const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
          if (discount < options.minDiscount) return false;
        }
        return true;
      });

      // Calculate Category Facets & Price Bounds
      const facetCounts: Record<string, number> = {};
      let globalMinPrice = Infinity;
      let globalMaxPrice = 0;

      for (const { product: p } of filtered) {
        facetCounts[p.categoryId] = (facetCounts[p.categoryId] || 0) + 1;
        const firstSv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = firstSv ? resolvePrice(firstSv, p.defaultPriceTier || "B2C") : 0;
        if (price > 0) {
          if (price < globalMinPrice) globalMinPrice = price;
          if (price > globalMaxPrice) globalMaxPrice = price;
        }
      }

      const categoryFacets = Object.entries(facetCounts).map(([catId, count]) => ({
        categoryId: catId,
        name: categoryMap.get(catId)?.name || catId,
        count,
      }));

      // Sorting
      const sortBy = options.sortBy || (queryStr.trim() ? "relevance" : "recommended");
      filtered.sort((a, b) => {
        if (sortBy === "relevance" || sortBy === "recommended") {
          if (a.score !== b.score) return b.score - a.score;
        }
        if (sortBy === "price-asc") {
          const pA = a.product.colorVariants?.[0]?.subVariants?.[0] ? resolvePrice(a.product.colorVariants[0].subVariants[0], a.product.defaultPriceTier || "B2C") : 0;
          const pB = b.product.colorVariants?.[0]?.subVariants?.[0] ? resolvePrice(b.product.colorVariants[0].subVariants[0], b.product.defaultPriceTier || "B2C") : 0;
          return pA - pB;
        }
        if (sortBy === "price-desc") {
          const pA = a.product.colorVariants?.[0]?.subVariants?.[0] ? resolvePrice(a.product.colorVariants[0].subVariants[0], a.product.defaultPriceTier || "B2C") : 0;
          const pB = b.product.colorVariants?.[0]?.subVariants?.[0] ? resolvePrice(b.product.colorVariants[0].subVariants[0], b.product.defaultPriceTier || "B2C") : 0;
          return pB - pA;
        }
        if (sortBy === "newest") {
          return new Date(b.product.createdAt || 0).getTime() - new Date(a.product.createdAt || 0).getTime();
        }
        return 0;
      });

      const total = filtered.length;
      const paginatedProducts = filtered.slice(skip, skip + limit).map((i) => i.product);

      return {
        products: paginatedProducts,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        exactSkuMatch,
        categoryFacets,
        priceRange: {
          min: globalMinPrice === Infinity ? 0 : globalMinPrice,
          max: globalMaxPrice,
        },
      };
    }

    // Client-side API fetch
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.sku) params.set("sku", options.sku);
    if (options.categoryId) params.set("categoryId", options.categoryId);
    if (options.minPrice !== undefined) params.set("minPrice", String(options.minPrice));
    if (options.maxPrice !== undefined) params.set("maxPrice", String(options.maxPrice));
    if (options.inStock) params.set("inStock", "true");
    if (options.minDiscount) params.set("minDiscount", String(options.minDiscount));
    if (options.sortBy) params.set("sortBy", options.sortBy);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));

    return apiClient.get<SearchResult>(`/search?${params.toString()}`);
  },

  /**
   * Ultra-fast autocomplete suggestion method for header search input.
   */
  async suggest(query: string, limit = 6): Promise<SuggestResult> {
    const q = query.trim();
    if (!q) {
      return { products: [], skus: [], categories: [] };
    }

    if (typeof window === "undefined") {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      await dbConnect();
      const ProductModel = (await import("@/models/Product")).default;
      const CategoryModel = (await import("@/models/Category")).default;

      const categories: Category[] = await CategoryModel.find({ isActive: true }).lean();
      const categoryMap = new Map<string, Category>(categories.map((c) => [c._id, c]));

      const rawProducts: Product[] = await ProductModel.find({ isActive: true }).lean();
      const parsedProducts: Product[] = JSON.parse(JSON.stringify(rawProducts));

      const scoredList: Array<{ product: Product; score: number; matchedSku?: string }> = [];
      const matchedSkus: SuggestResult["skus"] = [];

      const qLower = q.toLowerCase();

      for (const p of parsedProducts) {
        const { score, matchedSku } = calculateProductRelevanceScore(p, q, categoryMap);
        if (score > 0) {
          scoredList.push({ product: p, score, matchedSku });
        }

        // Collect SKU suggestions directly
        p.colorVariants?.forEach((cv) => {
          cv.subVariants?.forEach((sv) => {
            if (sv.sku && sv.sku.toLowerCase().includes(qLower)) {
              const svPrice = resolvePrice(sv, p.defaultPriceTier || "B2C");
              matchedSkus.push({
                sku: sv.sku,
                productId: p._id,
                productTitle: p.title,
                slug: p.slug,
                color: cv.color,
                size: sv.size,
                stock: sv.stock,
                price: svPrice,
              });
            }
          });
        });
      }

      scoredList.sort((a, b) => b.score - a.score);
      const topProducts = scoredList.slice(0, limit).map(({ product: p, matchedSku }) => {
        const firstCv = p.colorVariants?.[0];
        const firstSv = firstCv?.subVariants?.[0];
        const price = firstSv ? resolvePrice(firstSv, p.defaultPriceTier || "B2C") : 0;
        const firstImg = firstCv?.images?.[0];
        const rawImg = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || "";
        const image = rawImg && rawImg.trim() ? rawImg.trim() : "/placeholder.png";

        return {
          _id: p._id,
          title: p.title,
          slug: p.slug,
          price,
          image,
          matchedSku,
          stock: p.totalStock,
          categoryName: categoryMap.get(p.categoryId)?.name,
        };
      });

      // Matching categories
      const matchedCategories = categories
        .filter((c) => c.name.toLowerCase().includes(qLower))
        .map((c) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
          count: parsedProducts.filter((p) => p.categoryId === c._id).length,
        }))
        .slice(0, 4);

      return {
        products: topProducts,
        skus: matchedSkus.slice(0, 5),
        categories: matchedCategories,
      };
    }

    return apiClient.get<SuggestResult>(`/search/suggest?q=${encodeURIComponent(q)}&limit=${limit}`);
  },
};
