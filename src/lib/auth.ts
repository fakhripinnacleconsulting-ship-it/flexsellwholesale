import * as jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { SESSION_HINT_COOKIE, SESSION_HINT_MAX_AGE_SECONDS } from "@/lib/sessionHint";

const JWT_SECRET = process.env.JWT_SECRET as string;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
const TOKEN_EXPIRY = "1d"; // 1 day

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  customerTypes?: string[];
  permissions?: string[];
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JWTPayload;
  } catch (_error) {
    return null;
  }
}

export async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1 * 24 * 60 * 60, // 1 day
    path: "/",
  });

  // Generate and set csrf_token cookie (httpOnly: false so it's readable by client-side apiClient)
  const { generateCsrfToken } = await import("@/lib/csrf");
  cookieStore.set("csrf_token", generateCsrfToken(), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1 * 24 * 60 * 60,
    path: "/",
  });

  // Client-readable session *hint*. Lets the browser skip the "am I logged in?" probe
  // when there is obviously no session — see lib/sessionHint.ts. Never authorization.
  // Deliberately shorter-lived than the token so any desync self-heals.
  cookieStore.set(SESSION_HINT_COOKIE, "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_HINT_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function removeTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  cookieStore.set("csrf_token", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  // Clear the session hint in lockstep with the token — they must never drift.
  cookieStore.set(SESSION_HINT_COOKIE, "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get("token")?.value;
}

export async function getActiveCustomerServer() {
  try {
    const token = await getTokenFromCookie();
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const CustomerModel = (await import("@/models/Customer")).default;
    const customer = await CustomerModel.findById(payload.userId).select("-password").lean();
    if (!customer) return null;
    return JSON.parse(JSON.stringify(customer));
  } catch (error) {
    console.error("Error in getActiveCustomerServer:", error);
    return null;
  }
}

export async function getActiveManagerServer() {
  try {
    const token = await getTokenFromCookie();
    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload || payload.role !== "manager") return null;

    const dbConnect = (await import("@/lib/dbConnect")).default;
    await dbConnect();
    const ManagerModel = (await import("@/models/Manager")).default;
    const manager = await ManagerModel.findById(payload.userId).select("-password").lean();
    if (!manager) return null;
    return JSON.parse(JSON.stringify(manager));
  } catch (error) {
    console.error("Error in getActiveManagerServer:", error);
    return null;
  }
}
