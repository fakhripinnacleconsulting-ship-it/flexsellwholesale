import { useTheme as useNextTheme } from "next-themes";
import { useThemeStore } from "@/stores/themeStore";

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme();
  const { activeTheme, setTheme: setCustomTheme, resetTheme } = useThemeStore();

  return {
    mode: theme, // 'light' | 'dark' | 'system'
    setMode: setTheme,
    systemTheme,
    customTheme: activeTheme,
    setCustomTheme,
    resetTheme,
  };
}
