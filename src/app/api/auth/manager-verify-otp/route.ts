import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import OtpVerification from "@/models/OtpVerification";
import { signToken, setTokenCookie } from "@/lib/auth";

const MAX_OTP_ATTEMPTS = 5;

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required" }, { status: 400 });
    }

    const lowerEmail = email.trim().toLowerCase();

    // 1. Find OTP record
    const otpRecord = await OtpVerification.findOne({ email: lowerEmail });
    if (!otpRecord) {
      return NextResponse.json({ message: "OTP expired or invalid. Please request a new code." }, { status: 400 });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "OTP has expired. Please request a new code." }, { status: 400 });
    }

    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "Too many failed attempts. Please request a new OTP." }, { status: 429 });
    }

    const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    if (!timingSafeCompare(inputHash, otpRecord.otpHash)) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      return NextResponse.json({
        message: `Invalid OTP code. ${MAX_OTP_ATTEMPTS - otpRecord.attempts} attempts remaining.`
      }, { status: 400 });
    }

    // OTP Verified! Delete verification record
    await OtpVerification.deleteOne({ email: lowerEmail });

    // Find Manager
    const manager = await Manager.findOne({ email: lowerEmail });
    if (!manager) {
      return NextResponse.json({ message: "Manager account not found" }, { status: 404 });
    }

    if (manager.status === "suspended") {
      return NextResponse.json({ message: "Account suspended. Contact administrator." }, { status: 403 });
    }

    // 2. Update 60-Day Login History with automatic DB cleanup
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ip = req.headers.get("x-forwarded-for") || "unknown";

    // Auto cleanup DB: filter out session logs older than 60 days
    const existingHistory = (manager.loginHistory || []).filter((h: any) => new Date(h.loginTime) >= sixtyDaysAgo);
    existingHistory.push({
      loginTime: now,
      ipAddress: ip,
      logoutReason: "manual"
    });

    const updatedManager = await Manager.findOneAndUpdate(
      { _id: manager._id },
      {
        $set: {
          lastLogin: now,
          loginHistory: existingHistory
        }
      },
      { new: true }
    );

    // 3. Issue Session Token
    const token = signToken({
      userId: updatedManager._id,
      email: updatedManager.email,
      role: "manager",
      permissions: updatedManager.permissions,
    } as any);

    await setTokenCookie(token);

    const managerObj = updatedManager.toObject();
    delete managerObj.password;

    return NextResponse.json({
      message: "Manager authenticated successfully via 2FA OTP",
      manager: managerObj,
    });
  } catch (error: any) {
    console.error("Manager Verify OTP API error:", error);
    return NextResponse.json({ message: error.message || "OTP Verification failed" }, { status: 500 });
  }
}
