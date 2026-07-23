import { create } from "zustand";
import { HsnRecord } from "@/types";
import { hsnService } from "@/services/hsnService";
import { handleApiError } from "@/lib/apiClient";

interface HsnStoreState {
  hsns: HsnRecord[];
  supplierState: string; // Default: "Madhya Pradesh"
  isLoading: boolean;
  error: string | null;
  initializeHsns: () => Promise<void>;
  addHsn: (hsn: Omit<HsnRecord, "_id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateHsn: (id: string, updatedFields: Partial<HsnRecord>) => Promise<void>;
  deleteHsn: (id: string) => Promise<void>;
  setSupplierState: (stateName: string) => void;
}

export const useHsnStore = create<HsnStoreState>()((set, get) => ({
  hsns: [],
  supplierState: "Madhya Pradesh",
  isLoading: false,
  error: null,

  initializeHsns: async () => {
    if (get().hsns.length > 0) return;
    set({ isLoading: true, error: null });
    try {
      const data = await hsnService.getHsnRecords();
      set({ hsns: data, isLoading: false });
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to load HSN codes"),
        isLoading: false
      });
    }
  },

  addHsn: async (hsnData) => {
    set({ isLoading: true, error: null });
    try {
      const newRecord = await hsnService.createHsnRecord(hsnData);
      set((state) => ({ hsns: [...state.hsns, newRecord], isLoading: false }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to add HSN code"),
        isLoading: false
      });
      throw err;
    }
  },

  updateHsn: async (id, updatedFields) => {
    set({ isLoading: true, error: null });
    try {
      const updatedRecord = await hsnService.updateHsnRecord(id, updatedFields);
      set((state) => ({
        hsns: state.hsns.map((h) => (h._id === id ? updatedRecord : h)),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to update HSN code"),
        isLoading: false
      });
      throw err;
    }
  },

  deleteHsn: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await hsnService.deleteHsnRecord(id);
      set((state) => ({
        hsns: state.hsns.filter((h) => h._id !== id),
        isLoading: false
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to delete HSN code"),
        isLoading: false
      });
      throw err;
    }
  },

  setSupplierState: (stateName) => set({ supplierState: stateName })
}));
