import { NextRequest } from "next/server";

export function generateCsrfToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

/**
 * Validates the CSRF token from the request.
 * In a double-submit cookie pattern, the token in the X-CSRF-Token header
 * must match the token in the csrf_token cookie.
 */
export function validateCsrf(request: NextRequest | Request): boolean {
  try {
    let cookieToken: string | undefined;
    let headerToken: string | null;

    if (request instanceof NextRequest) {
      cookieToken = request.cookies.get("csrf_token")?.value;
      headerToken = request.headers.get("x-csrf-token");
    } else {
      // standard Request
      const cookieHeader = request.headers.get("cookie") || "";
      const matches = cookieHeader.match(/csrf_token=([^;]+)/);
      cookieToken = matches ? matches[1] : undefined;
      headerToken = request.headers.get("x-csrf-token");
    }

    if (!cookieToken || !headerToken) {
      return false;
    }

    return cookieToken === headerToken;
  } catch (error) {
    return false;
  }
}
