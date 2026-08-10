import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import bcrypt from "bcryptjs";
import { signToken, setTokenCookie } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { loginSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip);
    } catch (err) {
      return NextResponse.json({ message: "Too many login attempts. Try again later." }, { status: 429 });
    }

    await dbConnect();
    const body = await req.json();
    const validatedData = loginSchema.parse(body);
    const { identifier, password } = validatedData;

    const trimmedIdentifier = identifier.trim().toLowerCase();

    // Query Manager collection by email
    const manager = await Manager.findOne({ email: trimmedIdentifier });

    if (!manager) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    if (manager.status === "suspended") {
      return NextResponse.json({ message: "Your account is suspended. Contact administrator." }, { status: 403 });
    }

    if (!manager.password) {
      return NextResponse.json({ message: "Password not set for this manager account." }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, manager.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Generate 6-digit 2FA OTP
    const crypto = require("crypto");
    const OtpVerification = require("@/models/OtpVerification").default;
    const { emailService } = require("@/lib/emailService");

    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OtpVerification.findOneAndUpdate(
      { email: trimmedIdentifier },
      {
        email: trimmedIdentifier,
        otpHash,
        expiresAt,
        resendAfter: new Date(Date.now() + 30 * 1000),
        attempts: 0,
      },
      { upsert: true, new: true }
    );

    const isDev = process.env.NODE_ENV !== "production";
    const targetEmail = isDev ? "kuldeepmaurya4296@gmail.com" : "info@flexsellwholesale.com";

    await emailService.sendStaffOtpEmail(manager.email, rawOtp, manager.name, "Staff Manager");

    return NextResponse.json({
      requiresOtp: true,
      email: manager.email,
      targetEmail,
      devOtp: isDev ? rawOtp : undefined,
      message: `2FA Security Code sent to ${targetEmail}`
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    console.error("Manager Login API error:", error);
    return NextResponse.json({ message: (error as any).message || "Login failed" }, { status: 500 });
  }
}
