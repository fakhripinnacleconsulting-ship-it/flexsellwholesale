import { NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken, signToken, setTokenCookie } from "@/lib/auth";

export async function POST() {
  try {
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const newToken = signToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      customerTypes: payload.customerTypes,
    });

    await setTokenCookie(newToken);

    return NextResponse.json({ message: "Token refreshed successfully" });
  } catch (error: unknown) {
    console.error("Token refresh error:", error);
    return NextResponse.json({ message: "Failed to refresh token" }, { status: 500 });
  }
}
