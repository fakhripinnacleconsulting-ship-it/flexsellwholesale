import { NextResponse } from "next/server";
import { removeTokenCookie } from "@/lib/auth";

export async function POST() {
  try {
    await removeTokenCookie();
    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Logout failed" }, { status: 500 });
  }
}
