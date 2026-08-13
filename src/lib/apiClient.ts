import { clearSessionHint } from "@/lib/sessionHint";

/**
 * Server-side absolute base. Normalised to https with no trailing slash so a
 * misconfigured env var cannot send in-region server calls out over the public
 * internet just to be redirected (localhost is left alone for local dev).
 */
function resolveServerBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL
      : `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api`;

  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/^https?:\/\/localhost(:\d+)?/i.test(trimmed)) return trimmed;
  return trimmed.replace(/^http:\/\//i, "https://");
}

const BASE_URL = typeof window !== "undefined" ? "/api" : resolveServerBaseUrl();


export const isMockMode = typeof window !== "undefined" && 
  (localStorage.getItem("flexsell-mock-mode") === "true" || process.env.NEXT_PUBLIC_MOCK_MODE === "true");

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export class ApiError extends Error {
  status: number;
  info?: unknown;

  constructor(message: string, status: number, info?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.info = info;
  }
}

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const matches = document.cookie.match(/csrf_token=([^;]+)/);
  return matches ? matches[1] : null;
}

/**
 * Asks the server for a fresh CSRF token (which also re-seeds the csrf_token cookie).
 * Used both pre-emptively when no cookie exists, and as the recovery step when the
 * server rejects a token that has since rotated or expired.
 */
async function fetchFreshCsrfToken(): Promise<string | null> {
  try {
    const csrfRes = await fetch(`${BASE_URL}/csrf`, { method: "GET", cache: "no-store" });
    if (csrfRes.ok) {
      const csrfData = await csrfRes.json();
      if (csrfData?.csrfToken) return csrfData.csrfToken;
    }
  } catch {
    // fall through to re-reading the cookie the response may still have set
  }
  return readCsrfCookie();
}

/** A 403 that specifically means "your CSRF token was missing or stale", not "forbidden". */
function isCsrfRejection(status: number, data: unknown): boolean {
  if (status !== 403) return false;
  const message =
    typeof data === "object" && data !== null
      ? String((data as Record<string, unknown>).message ?? "")
      : String(data ?? "");
  return /csrf/i.test(message);
}

async function performRequest(
  url: string,
  path: string,
  options: RequestInit,
  csrfTokenOverride?: string | null
): Promise<{ response: Response; data: unknown }> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const method = options.method?.toUpperCase() || "GET";
  const isStateChanging = STATE_CHANGING_METHODS.includes(method);

  // Inject CSRF token from cookie for state-changing methods in browser environment
  if (typeof window !== "undefined" && typeof document !== "undefined" && isStateChanging) {
    let csrfToken = csrfTokenOverride ?? readCsrfCookie();

    if (!csrfToken && path !== "/csrf") {
      csrfToken = await fetchFreshCsrfToken();
    }

    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  // Only force no-store for state-changing methods; allow GET requests to use
  // browser/CDN default caching. Callers can still pass cache: "no-store" via options.
  const config: RequestInit = {
    ...options,
    headers,
    ...(isStateChanging && !options.cache ? { cache: "no-store" as RequestCache } : {}),
  };

  const response = await fetch(url, config);

  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  } else {
    data = await response.text();
  }

  return { response, data };
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    let { response, data } = await performRequest(url, path, options);

    // A rejected CSRF token usually means it rotated or expired underneath us — the
    // cookie is present but no longer matches. Re-acquire once and replay, so the user
    // never sees a spurious 403. Guarded to a single attempt, and never for /csrf itself.
    if (isCsrfRejection(response.status, data) && path !== "/csrf") {
      const freshToken = await fetchFreshCsrfToken();
      if (freshToken) {
        ({ response, data } = await performRequest(url, path, options, freshToken));
      }
    }

    if (!response.ok) {
      // The session is gone server-side. Drop the client-side hint so the next page
      // load stops short-circuiting and re-establishes real auth state.
      if (response.status === 401) {
        clearSessionHint();
      }

      const errorData = typeof data === "object" && data !== null ? (data as Record<string, any>) : null;
      const fallbackMsg = typeof data === "string" && data.trim().startsWith("<")
        ? `API route endpoint error (${response.status} ${response.statusText})`
        : `HTTP error! Status: ${response.status}`;

      throw new ApiError(
        errorData?.message || fallbackMsg,
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      error instanceof Error ? (error as any).message : "Network request failed",
      500
    );
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestInit) => 
    request<T>(path, { ...options, method: "GET" }),
    
  post: <T>(path: string, body?: unknown, options?: RequestInit) => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(path, { 
      ...options, 
      method: "POST", 
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined) 
    });
  },
    
  put: <T>(path: string, body?: unknown, options?: RequestInit) => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(path, { 
      ...options, 
      method: "PUT", 
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined) 
    });
  },
    
  patch: <T>(path: string, body?: unknown, options?: RequestInit) => {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    return request<T>(path, {
      ...options,
      method: "PATCH",
      body: isFormData ? (body as FormData) : (body ? JSON.stringify(body) : undefined)
    });
  },

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export function handleApiError(error: unknown, fallbackMessage: string = "An unexpected error occurred"): string {
  console.error("API error encountered:", error);
  if (error instanceof ApiError) {
    return (error as any).message;
  }
  if (error instanceof Error) {
    return (error as any).message;
  }
  return fallbackMessage;
}
