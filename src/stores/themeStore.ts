import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ThemeConfig, defaultTheme } from "@/config/theme.config";

interface ThemeState {
  activeTheme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      activeTheme: defaultTheme,
      setTheme: (theme) => set({ activeTheme: theme }),
      resetTheme: () => set({ activeTheme: defaultTheme }),
    }),
    {
      name: "flexsell-theme-storage",
    }
  )
);
