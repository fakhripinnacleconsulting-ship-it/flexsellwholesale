import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface AuthenticatedRequestState {
  userId: string;
  email: string;
  role: string;
}

export async function requireAuth(requiredRole?: "admin" | "customer"): Promise<{
  payload?: AuthenticatedRequestState;
  error?: NextResponse;
}> {
  try {
    const token = await getTokenFromCookie();
    if (!token) {
      return { error: NextResponse.json({ message: "Not authenticated" }, { status: 401 }) };
    }

    const payload = verifyToken(token);
    if (!payload) {
      return { error: NextResponse.json({ message: "Invalid session" }, { status: 401 }) };
    }

    if (requiredRole && payload.role !== requiredRole) {
      return { error: NextResponse.json({ message: "Insufficient permissions" }, { status: 403 }) };
    }

    return { payload };
  } catch (_error) {
    return { error: NextResponse.json({ message: "Auth validation error" }, { status: 401 }) };
  }
}
