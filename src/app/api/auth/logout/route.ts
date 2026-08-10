import { NextResponse } from "next/server";
import { removeTokenCookie, getTokenFromCookie, verifyToken } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";

export async function POST(req: Request) {
  try {
    let reason: "manual" | "auto_10pm" | "expired" = "manual";
    try {
      const url = new URL(req.url);
      const r = url.searchParams.get("reason");
      if (r === "auto_10pm" || r === "expired") reason = r;
    } catch {}

    const token = await getTokenFromCookie();
    if (token) {
      const payload = verifyToken(token);
      if (payload && payload.role === "manager") {
        await dbConnect();
        const mgr = await Manager.findById(payload.userId);
        if (mgr) {
          const now = new Date();
          mgr.lastLogout = now;
          if (Array.isArray(mgr.loginHistory) && mgr.loginHistory.length > 0) {
            const lastEntry = mgr.loginHistory[mgr.loginHistory.length - 1];
            if (!lastEntry.logoutTime) {
              lastEntry.logoutTime = now;
              lastEntry.logoutReason = reason;
            }
          }
          await mgr.save();
        }
      }
    }
    
    await removeTokenCookie();
    return NextResponse.json({ message: "Logged out successfully" });
  } catch (error: unknown) {
    console.error("Logout error:", error);
    return NextResponse.json({ message: (error as any).message || "Logout failed" }, { status: 500 });
  }
}
