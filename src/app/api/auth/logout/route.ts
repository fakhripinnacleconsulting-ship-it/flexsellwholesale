import { NextResponse } from "next/server";
import { removeTokenCookie, getTokenFromCookie, verifyToken } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";

export async function POST() {
  try {
    const token = await getTokenFromCookie();
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.role === "manager") {
        await dbConnect();
        await Manager.updateOne({ _id: payload.userId }, { $set: { lastLogout: new Date() } });
      }
    }
    
    await removeTokenCookie();
    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    console.error("Logout error:", error);
    return NextResponse.json({ message: (error as any).message || "Logout failed" }, { status: 500 });
  }
}
