import { create } from "zustand";
import { apiClient } from "@/lib/apiClient";

export interface StockLog {
  _id: string;
  sku: string;
  productName: string;
  variantDetails: string;
  actionType: "Scan Adjustment" | "CSV Bulk Import" | "Order Deduction" | "Manual Adjustment";
  change: number;
  prevStock: number;
  newStock: number;
  timestamp: string;
}

interface InventoryHistoryState {
  logs: StockLog[];
  isLoading: boolean;
  error: string | null;
  initializeLogs: () => Promise<void>;
  addLog: (log: Omit<StockLog, "_id" | "timestamp">) => Promise<void>;
  clearLogs: () => Promise<void>;
}

export const useInventoryHistoryStore = create<InventoryHistoryState>()((set) => ({
  logs: [],
  isLoading: false,
  error: null,

  initializeLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.get<StockLog[]>("/inventory/ledger");
      set({ logs: data, isLoading: false });
    } catch (err) {
      set({ 
        error: err instanceof Error ? (err as any).message : "Failed to load ledger history", 
        isLoading: false 
      });
    }
  },

  addLog: async (logData) => {
    try {
      const payload = {
        ...logData,
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      };
      
      const newLog = await apiClient.post<StockLog>("/inventory/ledger", payload);
      set((state) => ({ logs: [newLog, ...state.logs] }));
    } catch (err) {
      console.error("Failed to persist stock log to DB", err);
      // Fallback: local state insert to not break UI operations
      const newLog: StockLog = {
        ...logData,
        _id: Math.random().toString(36).substring(2, 11),
        timestamp: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      };
      set((state) => ({ logs: [newLog, ...state.logs] }));
    }
  },

  clearLogs: async () => {
    set({ isLoading: true });
    try {
      await apiClient.delete<void>("/inventory/ledger");
      set({ logs: [], isLoading: false });
    } catch (err) {
      set({ 
        error: err instanceof Error ? (err as any).message : "Failed to clear ledger history", 
        isLoading: false 
      });
    }
  },
}));
