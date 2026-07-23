const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

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
    if (["POST", "PUT", "DELETE"].includes(method)) {
      const matches = document.cookie.match(/csrf_token=([^;]+)/);
      const csrfToken = matches ? matches[1] : null;
      if (csrfToken) {
        headers.set("X-CSRF-Token", csrfToken);
      }
    }
  }

  const config: RequestInit = {
    ...options,
    headers,
    cache: "no-store",
  };

  try {
    const response = await fetch(url, config);
    
    let data: unknown;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorData = data as Record<string, any> | null;
      throw new ApiError(
        errorData?.message || `HTTP error! Status: ${response.status}`,
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
    
  post: <T>(path: string, body?: unknown, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: "POST", 
      body: body ? JSON.stringify(body) : undefined 
    }),
    
  put: <T>(path: string, body?: unknown, options?: RequestInit) => 
    request<T>(path, { 
      ...options, 
      method: "PUT", 
      body: body ? JSON.stringify(body) : undefined 
    }),
    
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
