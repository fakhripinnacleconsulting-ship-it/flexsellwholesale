export interface ThemeConfig {
  name: string;
  logo: { light: string; dark: string; alt: string };
  colors: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    card: string;
    cardForeground: string;
    border: string;
    destructive: string;
    success: string;
    warning: string;
  };
  borderRadius: string;
}

export const defaultTheme: ThemeConfig = {
  name: "FlexSell Emerald",
  logo: {
    light: "/images/logo/logo-light.svg",
    dark: "/images/logo/logo-dark.svg",
    alt: "FlexSell Logo",
  },
  colors: {
    primary: "#10b981",
    primaryForeground: "#ffffff",
    secondary: "#f1f5f9",
    secondaryForeground: "#0f172a",
    accent: "#f1f5f9",
    accentForeground: "#0f172a",
    background: "#ffffff",
    foreground: "#09090b",
    muted: "#f1f5f9",
    mutedForeground: "#64748b",
    card: "#ffffff",
    cardForeground: "#09090b",
    border: "#e2e8f0",
    destructive: "#ef4444",
    success: "#22c55e",
    warning: "#f59e0b",
  },
  borderRadius: "0.5rem",
};
