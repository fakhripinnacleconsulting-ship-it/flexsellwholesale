import { create } from "zustand";
import { Collection } from "@/types";
import { collectionService } from "@/services/collectionService";
import { handleApiError } from "@/lib/apiClient";

interface CollectionStoreState {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  initializeCollections: (initial?: Collection[]) => Promise<void>;
  addCollection: (collection: Omit<Collection, "_id" | "createdAt">) => Promise<Collection>;
  updateCollection: (id: string, updatedFields: Partial<Collection>) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
}

export const useCollectionStore = create<CollectionStoreState>()((set, get) => ({
  collections: [],
  isLoading: false,
  error: null,

  initializeCollections: async (initial) => {
    if (initial && initial.length > 0) {
      set({ collections: initial, isLoading: false });
      return;
    }
    if (get().collections.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const data = await collectionService.getCollections();
      set({ collections: data, isLoading: false });
    } catch (err) {
      set({ 
        collections: initial || [], 
        error: handleApiError(err, "Failed to load collections"), 
        isLoading: false 
      });
    }
  },

  addCollection: async (collectionData) => {
    set({ isLoading: true, error: null });
    try {
      const newCollection = await collectionService.createCollection(collectionData);
      set((state) => ({
        collections: [...state.collections, newCollection],
        isLoading: false
      }));
      return newCollection;
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to add collection"),
        isLoading: false
      });
      throw err;
    }
  },

  updateCollection: async (id, updatedFields) => {
    set({ isLoading: true, error: null });
    try {
      const updatedCollection = await collectionService.updateCollection(id, updatedFields);
      set((state) => ({
        collections: state.collections.map(c => c._id === id ? updatedCollection : c),
        isLoading: false
      }));
      return updatedCollection;
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to update collection"),
        isLoading: false
      });
      throw err;
    }
  },

  deleteCollection: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await collectionService.deleteCollection(id);
      set((state) => ({
        collections: state.collections.filter(c => c._id !== id),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to delete collection"),
        isLoading: false
      });
      throw err;
    }
  }
}));
