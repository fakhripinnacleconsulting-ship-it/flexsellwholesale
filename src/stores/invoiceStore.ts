import { create } from "zustand";
import { Invoice } from "@/types";
import { invoiceService, InvoiceListParams } from "@/services/invoiceService";
import { handleApiError } from "@/lib/apiClient";

interface InvoiceStoreState {
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  total: number;
  page: number;
  totalPages: number;
  initializeInvoices: (params?: InvoiceListParams) => Promise<void>;
  createInvoice: (data: Parameters<typeof invoiceService.createInvoice>[0]) => Promise<Invoice>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>;
  voidInvoice: (id: string) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
}

export const useInvoiceStore = create<InvoiceStoreState>()((set) => ({
  invoices: [],
  isLoading: false,
  error: null,
  total: 0,
  page: 1,
  totalPages: 1,

  initializeInvoices: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const data = await invoiceService.getInvoices(params) as any;
      if (Array.isArray(data)) {
        set({ invoices: data, total: data.length, isLoading: false });
      } else {
        set({
          invoices: data.invoices || [],
          total: data.total || 0,
          page: data.page || 1,
          totalPages: data.totalPages || 1,
          isLoading: false,
        });
      }
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to load invoices"),
        isLoading: false,
      });
    }
  },

  createInvoice: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const newInvoice = await invoiceService.createInvoice(data);
      set((state) => ({
        invoices: [newInvoice, ...state.invoices],
        total: state.total + 1,
        isLoading: false,
      }));
      return newInvoice;
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to create invoice"),
        isLoading: false,
      });
      throw err;
    }
  },

  updateInvoice: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await invoiceService.updateInvoice(id, data);
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv._id === id ? updated : inv)),
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to update invoice"),
        isLoading: false,
      });
      throw err;
    }
  },

  voidInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await invoiceService.voidInvoice(id);
      set((state) => ({
        invoices: state.invoices.map((inv) => (inv._id === id ? updated : inv)),
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to void invoice"),
        isLoading: false,
      });
      throw err;
    }
  },

  deleteInvoice: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await invoiceService.deleteInvoice(id);
      set((state) => ({
        invoices: state.invoices.filter((inv) => inv._id !== id),
        total: state.total - 1,
        isLoading: false,
      }));
    } catch (err) {
      set({
        error: handleApiError(err, "Failed to delete invoice"),
        isLoading: false,
      });
      throw err;
    }
  },
}));
