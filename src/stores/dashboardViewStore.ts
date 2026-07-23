import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DashboardView = "B2C" | "B2B" | "Dropshipping";

interface DashboardViewState {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
}

export const useDashboardViewStore = create<DashboardViewState>()(
  persist(
    (set) => ({
      activeView: "B2C",
      setActiveView: (view) => set({ activeView: view }),
    }),
    {
      name: "client_dashboard_view",
    }
  )
);
