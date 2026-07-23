import { create } from "zustand";
import { Customer } from "@/types";
import { apiClient } from "@/lib/apiClient";

interface AuthState {
  customer: Customer | null;
  isLoading: boolean;
  error: string | null;
  
  login: (identifier: string, password: string) => Promise<boolean>;
  registerCustomer: (data: any) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  customer: null,
  isLoading: false,
  error: null,

  login: async (identifier, password) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post<{ customer: Customer; message: string }>("/auth/login", { identifier, password });
      set({ customer: data.customer, isLoading: false });
      if (data.customer?.customerTypes?.length > 0) {
        try {
          const { useDashboardViewStore } = await import("./dashboardViewStore");
          useDashboardViewStore.getState().setActiveView(data.customer.customerTypes[0]);
        } catch (e) {
          console.error("Failed to set dashboard view", e);
        }
      }
      return true;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? (err as any).message : "Login failed", isLoading: false });
      return false;
    }
  },

  registerCustomer: async (customerData) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post<{ customer: Customer; message: string }>("/auth/register", customerData);
      set({ customer: data.customer, isLoading: false });
      if (data.customer?.customerTypes?.length > 0) {
        try {
          const { useDashboardViewStore } = await import("./dashboardViewStore");
          useDashboardViewStore.getState().setActiveView(data.customer.customerTypes[0]);
        } catch (e) {
          console.error("Failed to set dashboard view", e);
        }
      }
      return true;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? (err as any).message : "Registration failed", isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (idToken) => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient.post<{ customer: Customer; message: string }>("/auth/google-login", { idToken });
      set({ customer: data.customer, isLoading: false });
      if (data.customer?.customerTypes?.length > 0) {
        try {
          const { useDashboardViewStore } = await import("./dashboardViewStore");
          useDashboardViewStore.getState().setActiveView(data.customer.customerTypes[0]);
        } catch (e) {
          console.error("Failed to set dashboard view", e);
        }
      }
      return true;
    } catch (err: unknown) {
      set({ error: err instanceof Error ? (err as any).message : "Google authentication failed", isLoading: false });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.error("Logout API failed", err);
    } finally {
      set({ customer: null, isLoading: false });
      window.location.href = "/login";
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const data = await apiClient.get<Customer>("/customers/active");
      set({ customer: data });
      if (data?.customerTypes?.length > 0) {
        try {
          const { useDashboardViewStore } = await import("./dashboardViewStore");
          // Only override if active view is not in customerTypes
          const currentView = useDashboardViewStore.getState().activeView;
          if (!data.customerTypes.includes(currentView)) {
            useDashboardViewStore.getState().setActiveView(data.customerTypes[0]);
          }
        } catch (e) {
          console.error("Failed to sync dashboard view", e);
        }
      }
    } catch (err) {
      set({ customer: null });
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
