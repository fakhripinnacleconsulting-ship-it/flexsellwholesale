import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, systemTheme } = useNextTheme();

  return {
    mode: theme, // 'light' | 'dark' | 'system'
    setMode: setTheme,
    systemTheme,
  };
}
