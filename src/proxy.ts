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
  // Pre-session auth endpoints have no session to protect and are reached before a CSRF
  // cookie exists. Note this is deliberately a list of specific routes rather than the whole
  // /api/auth/ prefix: change-password acts on an established session, so blanket-excluding
  // the prefix left it open to a cross-site POST that takes over the account.
  const CSRF_EXEMPT_AUTH_ROUTES = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/google-login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/send-otp",
    "/api/auth/verify-otp",
  ];

  // Third-party callbacks cannot carry our CSRF cookie; each of these verifies its own
  // HMAC/token signature instead.
  const isExcludedCsrf =
    CSRF_EXEMPT_AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)) ||
    pathname.startsWith("/api/system-diagnostics") ||
    pathname.startsWith("/api/shiprocket/webhook") ||
    pathname.startsWith("/api/razorpay/webhook") ||
    pathname.startsWith("/api/customers/upload-document") ||
    pathname.startsWith("/api/upload");

  if (isApiRoute && isStateChanging && !isExcludedCsrf) {
    const isTestMode = process.env.TEST_MODE === "true";
    if (!isTestMode && !validateCsrf(request)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid or missing CSRF token" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const isClientPath = pathname.startsWith("/client");
  const isAdminPath = pathname.startsWith("/admin");
  const isManagerPath = pathname.startsWith("/manager") && !pathname.startsWith("/manager/login");
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/manager/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (isClientPath || isAdminPath || isManagerPath) {
    if (!token) {
      const url = new URL(isManagerPath ? "/manager/login" : "/login", request.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }

    const payload = await verifyJwtEdge(token);
    if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL(isManagerPath ? "/manager/login" : "/login", request.url));
      response.cookies.delete("token");
      return response;
    }

    if (isAdminPath && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isManagerPath && payload.role !== "manager" && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (isClientPath && payload.role !== "customer") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  if (isAuthPage && token) {
    const payload = await verifyJwtEdge(token);
    if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
      let dest = "/client";
      if (payload.role === "admin") dest = "/admin";
      if (payload.role === "manager") dest = "/manager";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  const response = NextResponse.next();
  if (!request.cookies.get("csrf_token")) {
    const { generateCsrfToken } = await import("@/lib/csrf");
    response.cookies.set("csrf_token", generateCsrfToken(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
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
    let headerB64Padded = headerB64.replace(/-/g, "+").replace(/_/g, "/");
    headerB64Padded = headerB64Padded.padEnd(headerB64Padded.length + (4 - (headerB64Padded.length % 4)) % 4, "=");
    const headerString = atob(headerB64Padded);
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
    let sigBase64 = signatureB64.replace(/-/g, "+").replace(/_/g, "/");
    sigBase64 = sigBase64.padEnd(sigBase64.length + (4 - (sigBase64.length % 4)) % 4, "=");
    const sigString = atob(sigBase64);
    const sigBytes = new Uint8Array(sigString.length);
    for (let i = 0; i < sigString.length; i++) {
      sigBytes[i] = sigString.charCodeAt(i);
    }

    const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, dataToVerify);
    if (!isValid) return null;

    // Decode payload
    let payloadB64Padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    payloadB64Padded = payloadB64Padded.padEnd(payloadB64Padded.length + (4 - (payloadB64Padded.length % 4)) % 4, "=");
    const jsonPayload = decodeURIComponent(
      atob(payloadB64Padded)
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
    "/manager/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/:path*"
  ],
};
