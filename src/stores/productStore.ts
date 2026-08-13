import { create } from "zustand";
import { Product } from "@/types";
import { productService } from "@/services/productService";
import { handleApiError } from "@/lib/apiClient";

/** Shared promise so two listing components mounting together issue one catalog fetch. */
let inFlightCatalogLoad: Promise<void> | null = null;

const CATALOG_CACHE_KEY = "flexsell-catalog-cache";
/** Short enough that catalog edits surface quickly, long enough to cover a browse session. */
const CATALOG_CACHE_TTL_MS = 10 * 60 * 1000;

function readCachedCatalog(): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.products)) return null;
    if (Date.now() - (parsed.at || 0) > CATALOG_CACHE_TTL_MS) return null;
    return parsed.products as Product[];
  } catch {
    return null;
  }
}

function writeCachedCatalog(products: Product[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ at: Date.now(), products }));
  } catch {
    // Quota exceeded on a large catalog is fine — we just refetch next navigation.
  }
}

interface ProductStoreState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  /** True once the full catalog has been fetched, not just an SSR seed slice. */
  isCatalogComplete: boolean;
  /**
   * Fetches the whole catalog once, in the background.
   *
   * Listing pages are server-rendered with a small slice for fast first paint, but all
   * filtering, sorting and infinite scroll run client-side — so without this the user
   * could never reach past the seeded slice and filters would silently miss products.
   */
  loadFullCatalog: () => Promise<void>;
  initializeProducts: (initial?: Product[], force?: boolean) => Promise<void>;
  addProduct: (product: Omit<Product, "_id" | "createdAt">) => Promise<void>;
  updateProduct: (id: string, updatedFields: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  bulkDeleteProducts: (ids: string[]) => Promise<void>;
  getProductBySlug: (slug: string) => Promise<Product>;
}

export const useProductStore = create<ProductStoreState>()((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  isCatalogComplete: false,

  loadFullCatalog: async () => {
    if (get().isCatalogComplete) return;

    // The store is not persisted, so without this every full page load of /products or
    // /categories/[slug] re-fetched the entire catalog. Reuse it for the rest of the
    // browsing session instead; a new tab or reload past the TTL fetches fresh.
    const cached = readCachedCatalog();
    if (cached && cached.length >= get().products.length) {
      set({ products: cached, isCatalogComplete: true, error: null });
      return;
    }

    // Coalesce concurrent callers (e.g. two listing components mounting together).
    if (inFlightCatalogLoad) {
      await inFlightCatalogLoad;
      return;
    }

    inFlightCatalogLoad = (async () => {
      try {
        // listView drops aPlusContent / seo* / barcode images — none of which any
        // listing, filter or search-scoring path reads.
        const data = await productService.getProducts({ listView: true });
        // Never replace a fuller list with a shorter one (e.g. a request that raced a seed).
        if (data.length >= get().products.length) {
          set({ products: data, isCatalogComplete: true, error: null });
          writeCachedCatalog(data);
        } else {
          set({ isCatalogComplete: true });
        }
      } catch (err) {
        // Non-fatal: the seeded slice stays usable, we just could not extend it.
        console.warn("Background catalog load failed:", handleApiError(err, "Failed to load full catalog"));
      } finally {
        inFlightCatalogLoad = null;
      }
    })();

    await inFlightCatalogLoad;
  },

  initializeProducts: async (initial, force = false) => {
    if (!force && initial && initial.length > 0) {
      const current = get().products;
      if (current.length === initial.length && current[0]?._id === initial[0]?._id) {
        return;
      }
      set({ products: initial, isLoading: false });
      return;
    }
    if (!force && get().products.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const data = await productService.getProducts();
      // This branch fetches unbounded, so the catalog is complete afterwards.
      set({ products: data, isLoading: false, isCatalogComplete: true });
    } catch (err) {
      set({
        products: get().products.length > 0 ? get().products : (initial || []),
        error: handleApiError(err, "Failed to load products"),
        isLoading: false
      });
    }
  },

  getProductBySlug: async (slug) => {
    const existing = get().products.find(p => p.slug === slug);
    if (existing) return existing;
    set({ isLoading: true, error: null });
    try {
      const product = await productService.getProductBySlug(slug);
      set((state) => ({ 
        products: [...state.products, product], 
        isLoading: false 
      }));
      return product;
    } catch (err) {
      set({ 
        error: handleApiError(err, "Failed to load product"), 
        isLoading: false 
      });
      throw err;
    }
  },

  addProduct: async (productData) => {
    set({ isLoading: true, error: null });
    try {
      const newProduct = await productService.createProduct(productData);
      set((state) => ({ 
        products: [newProduct, ...state.products], 
        isLoading: false 
      }));
    } catch (err) {
      set({ 
        error: handleApiError(err, "Failed to add product"), 
        isLoading: false 
      });
      throw err;
    }
  },

  updateProduct: async (id, updatedFields) => {
    set({ isLoading: true, error: null });
    try {
      const updatedProduct = await productService.updateProduct(id, updatedFields);
      set((state) => ({
        products: state.products.map(p => p._id === id ? updatedProduct : p),
        isLoading: false
      }));
    } catch (err) {
      set({ 
        error: handleApiError(err, "Failed to update product"), 
        isLoading: false 
      });
      throw err;
    }
  },

  deleteProduct: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await productService.deleteProduct(id);
      set((state) => ({
        products: state.products.filter(p => p._id !== id),
        isLoading: false
      }));
    } catch (err) {
      set({ 
        error: handleApiError(err, "Failed to delete product"), 
        isLoading: false 
      });
      throw err;
    }
  },

  bulkDeleteProducts: async (ids) => {
    set({ isLoading: true, error: null });
    try {
      await productService.bulkDeleteProducts(ids);
      set((state) => ({
        products: state.products.filter(p => !ids.includes(p._id)),
        isLoading: false
      }));
    } catch (err) {
      set({ 
        error: handleApiError(err, "Failed to delete products in bulk"), 
        isLoading: false 
      });
      throw err;
    }
  }
}));
