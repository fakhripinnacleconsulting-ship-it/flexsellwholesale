import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateCsrf } from "@/lib/csrf";

const JWT_SECRET = process.env.JWT_SECRET;

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const { pathname } = request.nextUrl;

  // CSRF validation for state-changing API routes
  const isApiRoute = pathname.startsWith("/api");
  const isStateChanging = ["POST", "PUT", "DELETE"].includes(request.method);
  const isExcludedAuth = pathname.startsWith("/api/auth/");

  if (isApiRoute && isStateChanging && !isExcludedAuth) {
    if (!validateCsrf(request)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid or missing CSRF token" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const isClientPath = pathname.startsWith("/client");
  const isAdminPath = pathname.startsWith("/admin");
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (isClientPath || isAdminPath) {
    if (!token) {
      const url = new URL("/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    const payload = await verifyJwtEdge(token);
    if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }

    if (isAdminPath && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isClientPath && payload.role !== "customer") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (isAuthPage && token) {
    const payload = await verifyJwtEdge(token);
    if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
      const dest = payload.role === "admin" ? "/admin" : "/client";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  return NextResponse.next();
}

async function verifyJwtEdge(token: string) {
  try {
    if (!JWT_SECRET) {
      console.error("JWT_SECRET environment variable is missing!");
      return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header to ensure it's HS256
    const headerString = atob(headerB64.replace(/-/g, "+").replace(/_/g, "/"));
    const headerJson = JSON.parse(headerString);
    if (headerJson.alg !== "HS256") return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Convert signature from base64url to bytes
    const sigBase64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    const sigString = atob(sigBase64);
    const sigBytes = new Uint8Array(sigString.length);
    for (let i = 0; i < sigString.length; i++) {
      sigBytes[i] = sigString.charCodeAt(i);
    }

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, dataToVerify);
    if (!isValid) return null;

    // Decode payload
    const jsonPayload = decodeURIComponent(
      atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"))
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (_error) {
    return null;
  }
}

export const config = {
  matcher: [
    "/client/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/:path*"
  ],
};
