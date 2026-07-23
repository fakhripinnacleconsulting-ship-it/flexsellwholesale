import { create } from "zustand";
import { Product } from "@/types";
import { productService } from "@/services/productService";
import { handleApiError } from "@/lib/apiClient";

interface ProductStoreState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
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

  initializeProducts: async (initial, force = false) => {
    if (!force && initial && initial.length > 0) {
      set({ products: initial, isLoading: false });
      return;
    }
    if (!force && get().products.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const data = await productService.getProducts();
      set({ products: data, isLoading: false });
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
