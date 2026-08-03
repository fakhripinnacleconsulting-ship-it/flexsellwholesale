import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();

    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "manager") {
      return NextResponse.json({ message: "Invalid session or not a manager" }, { status: 401 });
    }

    const manager = await Manager.findById(payload.userId).select("-password").lean();

    if (!manager) {
      return NextResponse.json({ message: "Manager not found" }, { status: 404 });
    }

    if (manager.status === "suspended") {
      return NextResponse.json({ message: "Account suspended" }, { status: 403 });
    }

    return NextResponse.json(manager);
  } catch (error) {
    console.error("Manager Active Session Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
