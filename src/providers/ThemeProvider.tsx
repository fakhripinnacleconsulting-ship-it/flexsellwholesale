"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useThemeStore } from "@/stores/themeStore";

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

// Global fetch interceptor to inject CSRF tokens into all client-side state-changing API requests
if (typeof window !== "undefined" && !(window as any).__csrf_intercepted) {
  (window as any).__csrf_intercepted = true;
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    let url = "";
    let method = "GET";

    if (typeof input === "string") {
      url = input;
      method = (init?.method || "GET").toUpperCase();
    } else if (input instanceof URL) {
      url = input.toString();
      method = (init?.method || "GET").toUpperCase();
    } else if (input && (input as any).url) {
      url = (input as any).url;
      method = ((input as any).method || init?.method || "GET").toUpperCase();
    }

    const isApi = url.includes("/api/") || url.startsWith("/api");
    const isStateChanging = ["POST", "PUT", "DELETE"].includes(method);

    if (isApi && isStateChanging) {
      const matches = document.cookie.match(/csrf_token=([^;]+)/);
      const csrfToken = matches ? matches[1] : null;
      if (csrfToken) {
        if (typeof input === "string" || input instanceof URL) {
          init = init || {};
          const headers = new Headers(init.headers);
          if (!headers.has("X-CSRF-Token")) {
            headers.set("X-CSRF-Token", csrfToken);
          }
          init.headers = headers;
        } else if (input && (input as any).headers) {
          try {
            if (typeof (input as any).headers.set === "function") {
              if (!(input as any).headers.has("X-CSRF-Token")) {
                (input as any).headers.set("X-CSRF-Token", csrfToken);
              }
            }
          } catch (e) {
            try {
              const newHeaders = new Headers((input as any).headers);
              if (!newHeaders.has("X-CSRF-Token")) {
                newHeaders.set("X-CSRF-Token", csrfToken);
              }
              input = new Request(input, { headers: newHeaders });
            } catch (err) {
              console.error("Failed to inject CSRF token into Request object", err);
            }
          }
        }
      }
    }
    return originalFetch.call(this, input, init);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  const activeTheme = useThemeStore((state) => state.activeTheme);

  // Inject CSS variables for the active theme dynamically
  React.useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      
      // Map theme colors to CSS variables
      // In Tailwind v4, we defined these in globals.css. We can override them inline.
      const vars = {
        "--primary": activeTheme.colors.primary,
        "--primary-foreground": activeTheme.colors.primaryForeground,
        "--secondary": activeTheme.colors.secondary,
        "--secondary-foreground": activeTheme.colors.secondaryForeground,
        "--accent": activeTheme.colors.accent,
        "--accent-foreground": activeTheme.colors.accentForeground,
        "--background": activeTheme.colors.background,
        "--foreground": activeTheme.colors.foreground,
        "--muted": activeTheme.colors.muted,
        "--muted-foreground": activeTheme.colors.mutedForeground,
        "--card": activeTheme.colors.card,
        "--card-foreground": activeTheme.colors.cardForeground,
        "--border": activeTheme.colors.border,
        "--destructive": activeTheme.colors.destructive,
        "--radius": activeTheme.borderRadius,
      };

      Object.entries(vars).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }, [activeTheme]);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
