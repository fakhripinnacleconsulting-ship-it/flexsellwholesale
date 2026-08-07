const BASE_URL = typeof window !== "undefined"
  ? "/api"
  : (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL
      : `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api`);


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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Inject CSRF token from cookie for state-changing methods in browser environment
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const method = options.method?.toUpperCase() || "GET";
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      let matches = document.cookie.match(/csrf_token=([^;]+)/);
      let csrfToken = matches ? matches[1] : null;

      if (!csrfToken && path !== "/csrf") {
        try {
          const csrfRes = await fetch(`${BASE_URL}/csrf`, { method: "GET" });
          if (csrfRes.ok) {
            const csrfData = await csrfRes.json();
            csrfToken = csrfData?.csrfToken || null;
          }
        } catch {
          // Fallback to checking document.cookie again
        }
        if (!csrfToken) {
          matches = document.cookie.match(/csrf_token=([^;]+)/);
          csrfToken = matches ? matches[1] : null;
        }
      }

      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
      }
    }
  }

  // Only force no-store for state-changing methods; allow GET requests to use
  // browser/CDN default caching. Callers can still pass cache: "no-store" via options.
  const method = options.method?.toUpperCase() || "GET";
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const config: RequestInit = {
    ...options,
    headers,
    ...(isStateChanging && !options.cache ? { cache: "no-store" as RequestCache } : {}),
  };

  try {
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

    if (!response.ok) {
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
