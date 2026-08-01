"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { AlertTriangle } from "lucide-react";

const GSI_SCRIPT_ID = "google-gsi-script";
const GSI_SRC = "https://accounts.google.com/gsi/client";

// Google's renderButton only accepts a fixed pixel width — it has no fluid/percentage
// option — so we measure the container and re-render whenever it changes size.
// 200/400 are Google's own supported bounds.
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

// Read once at module scope: NEXT_PUBLIC_* vars are inlined at build time, so this is
// a constant and never needs to live in component state.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GsiButtonOptions {
  theme: "outline" | "filled_black" | "filled_blue";
  size: "large" | "medium" | "small";
  width: number;
  text: string;
  shape: "rectangular" | "pill" | "circle" | "square";
  logo_alignment: "left" | "center";
}

interface GsiIdClient {
  initialize(config: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(parent: HTMLElement, options: GsiButtonOptions): void;
}

function getGsi(): GsiIdClient | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { google?: { accounts?: { id?: GsiIdClient } } })
    .google?.accounts?.id;
}

function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Not in a browser"));
      return;
    }
    if (getGsi()) {
      resolve();
      return;
    }

    const existing = document.getElementById(GSI_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("GSI script failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = GSI_SCRIPT_ID;
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GSI script failed to load"));
    document.body.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  /** Called with the Google ID token (JWT) once the user completes sign-in. */
  onCredential: (credential: string) => void;
  /** Button label variant. */
  text?: "signin_with" | "signup_with" | "continue_with";
}

export function GoogleSignInButton({ onCredential, text = "signin_with" }: GoogleSignInButtonProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const lastWidthRef = React.useRef(0);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Keep the latest callback without re-running the setup effect on every parent render.
  const onCredentialRef = React.useRef(onCredential);
  React.useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  React.useEffect(() => {
    if (!CLIENT_ID) return;

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    const renderButton = () => {
      const container = containerRef.current;
      const gsi = getGsi();
      if (!container || !gsi) return;

      const available = container.clientWidth || MAX_WIDTH;
      const width = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, available)));

      // Guard against a re-render loop: the ResizeObserver fires when we swap the
      // button out, so skip when the usable width has not actually changed.
      if (width === lastWidthRef.current) return;
      lastWidthRef.current = width;

      container.innerHTML = "";
      gsi.renderButton(container, {
        theme: isDark ? "filled_black" : "outline",
        size: "large",
        width,
        text,
        shape: "rectangular",
        logo_alignment: "left",
      });
    };

    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        const gsi = getGsi();
        if (!gsi) {
          setLoadFailed(true);
          return;
        }

        gsi.initialize({
          client_id: CLIENT_ID,
          callback: (response) => {
            if (response?.credential) {
              onCredentialRef.current(response.credential);
            }
          },
        });

        setLoadFailed(false);
        lastWidthRef.current = 0;
        renderButton();

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(renderButton);
          observer.observe(containerRef.current);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [text, isDark]);

  // Fail loudly rather than falling back to another project's client ID — a wrong
  // client ID surfaces much later as an opaque "Error 400: origin_mismatch" from Google.
  const message = !CLIENT_ID
    ? "Google Sign-In is not configured. NEXT_PUBLIC_GOOGLE_CLIENT_ID is missing."
    : loadFailed
    ? "Could not load Google Sign-In. Please check your connection."
    : null;

  if (message) {
    return (
      <div className="w-full flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div
        ref={containerRef}
        className="w-full max-w-[400px] min-h-[44px] flex justify-center items-center [color-scheme:light]"
      />
    </div>
  );
}
