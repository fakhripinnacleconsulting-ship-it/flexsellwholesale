import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Customer } from "@/types";
import { apiClient, ApiError } from "@/lib/apiClient";
import { hasSessionHint, clearSessionHint } from "@/lib/sessionHint";

/** Shared promise so concurrent checkSession() callers issue one request, not N. */
let inFlightSessionCheck: Promise<void> | null = null;

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
          // Clear the hint locally too: if the logout call failed, the server never got
          // to clear it, and a stale hint would keep probing a dead session.
          clearSessionHint();
          set({ customer: null, manager: null, isLoading: false });
          if (isManagerSession) {
            window.location.href = "/manager/login";
          } else {
            window.location.href = "/login";
          }
        }
      },

      checkSession: async () => {
        // Guests have no session to look up. Without this guard every logged-out
        // pageview cost two uncacheable origin calls (/customers/active -> 401, then
        // /managers/active -> 401), which dominated function invocations.
        //
        // The hint is set/cleared server-side alongside the token (lib/auth.ts) and is
        // shorter-lived than the JWT, so a desync resolves itself on the next load.
        if (!hasSessionHint()) {
          set({ customer: null, manager: null, isLoading: false });
          return;
        }

        // Collapse concurrent callers (remounts, multiple components) onto one request.
        if (inFlightSessionCheck) return inFlightSessionCheck;

        const run = async () => {
        set({ isLoading: true });
        try {
          // /customers/active returns the customer, 401 when there is no valid session,
          // or 403 ("Role mismatch") when the session belongs to a manager. Only the 403
          // case is worth a follow-up call — a 401 means nobody is logged in.
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
          // Only a 403 ("Role mismatch") indicates a manager session worth resolving.
          // A 401 means there is no session at all, so the second call would just be a
          // guaranteed second 401 — that chain was doubling the cost of every guest view.
          if (err instanceof ApiError && err.status === 403) {
            try {
              const mgrData = await apiClient.get<any>("/managers/active");
              set({ manager: mgrData, customer: null });
            } catch {
              set({ customer: null, manager: null });
            }
          } else {
            set({ customer: null, manager: null });
          }
        } finally {
          set({ isLoading: false });
        }
        };

        inFlightSessionCheck = run().finally(() => {
          inFlightSessionCheck = null;
        });
        return inFlightSessionCheck;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "flexsell-auth-storage",
      partialize: (state) => ({ customer: state.customer, manager: state.manager }),
    }
  )
);
