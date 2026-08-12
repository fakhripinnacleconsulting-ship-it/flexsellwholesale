import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types";
import { apiClient } from "@/lib/apiClient";

interface AuthState {
  customer: Customer | null;
  manager: any | null;
  isLoading: boolean;
  error: string | null;
  
  login: (identifier: string, password: string) => Promise<boolean>;
  managerLogin: (email: string, password: string) => Promise<boolean>;
  registerCustomer: (data: any) => Promise<boolean>;
  loginWithGoogle: (idToken: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      customer: null,
      manager: null,
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
          try {
            const { useCartStore } = await import("./cartStore");
            useCartStore.getState().hydrateProducts();
          } catch (e) {
            console.error("Failed to hydrate cart on login", e);
          }
          return true;
        } catch (err: unknown) {
          set({ error: err instanceof Error ? (err as any).message : "Login failed", isLoading: false });
          return false;
        }
      },

      managerLogin: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiClient.post<{ manager: any; message: string }>("/auth/manager-login", { identifier: email, password });
          set({ manager: data.manager, isLoading: false });
          return true;
        } catch (err: unknown) {
          set({ error: err instanceof Error ? (err as any).message : "Manager login failed", isLoading: false });
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
          try {
            const { useCartStore } = await import("./cartStore");
            useCartStore.getState().hydrateProducts();
          } catch (e) {
            console.error("Failed to hydrate cart on register", e);
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
          try {
            const { useCartStore } = await import("./cartStore");
            useCartStore.getState().hydrateProducts();
          } catch (e) {
            console.error("Failed to hydrate cart on google login", e);
          }
          return true;
        } catch (err: unknown) {
          set({ error: err instanceof Error ? (err as any).message : "Google authentication failed", isLoading: false });
          return false;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        const isManagerSession = !!useAuthStore.getState().manager;
        try {
          await apiClient.post("/auth/logout");
        } catch (err) {
          console.error("Logout API failed", err);
        } finally {
          set({ customer: null, manager: null, isLoading: false });
          if (isManagerSession) {
            window.location.href = "/manager/login";
          } else {
            window.location.href = "/login";
          }
        }
      },

      checkSession: async () => {
        set({ isLoading: true });
        try {
          // Check if it's a manager or customer by fetching a generic profile endpoint or active customer
          // For now, since managers have a separate UI, we can check if they have a manager token
          // Since /customers/active currently returns the customer or 401 if it's a manager
          // we can catch it and try to fetch manager profile if it fails.
          const data = await apiClient.get<Customer>("/customers/active");
          set({ customer: data, manager: null });
          if (data?.customerTypes?.length > 0) {
            try {
              const { useDashboardViewStore } = await import("./dashboardViewStore");
              const currentView = useDashboardViewStore.getState().activeView;
              if (!data.customerTypes.includes(currentView)) {
                useDashboardViewStore.getState().setActiveView(data.customerTypes[0]);
              }
            } catch (e) {
              console.error("Failed to sync dashboard view", e);
            }
          }
          try {
            const { useCartStore } = await import("./cartStore");
            useCartStore.getState().hydrateProducts();
          } catch (e) {
            console.error("Failed to hydrate cart on session check", e);
          }
        } catch (err) {
          // If customer fetch fails, it might be a manager. Let's try fetching manager active session
          try {
             const mgrData = await apiClient.get<any>("/managers/active");
             set({ manager: mgrData, customer: null });
          } catch (mgrErr) {
             set({ customer: null, manager: null });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "flexsell-auth-storage",
      partialize: (state) => ({ customer: state.customer, manager: state.manager }),
    }
  )
);
