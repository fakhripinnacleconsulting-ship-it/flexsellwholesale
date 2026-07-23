import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import OtpVerification from "@/models/OtpVerification";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { emailService } from "@/lib/emailService";

// Route handler for sending OTP verification email with updated SMTP config
export async function POST(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0] : "127.0.0.1";

  try {
    await rateLimit(ip);
  } catch {
    return NextResponse.json({ message: "Too many verification requests. Please wait 15 minutes before trying again." }, { status: 429 });
  }

  try {
    await dbConnect();
    const body = await req.json();

    // 1. Validate registration schema
    const validatedData = registerSchema.parse(body);
    const { email, name } = validatedData;
    const lowerEmail = email.toLowerCase().trim();

    // 2. Check if email already registered
    const existingCustomer = await Customer.findOne({ email: lowerEmail });
    if (existingCustomer) {
      return NextResponse.json({ message: "An account with this email address is already registered." }, { status: 400 });
    }

    // 3. Resend cooldown check (60 seconds)
    const existingOtp = await OtpVerification.findOne({ email: lowerEmail });
    if (existingOtp && existingOtp.resendAfter > new Date()) {
      const waitSecs = Math.ceil((existingOtp.resendAfter.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { message: `Please wait ${waitSecs} seconds before requesting a new verification code.` },
        { status: 429 }
      );
    }

    // 4. Generate 6-digit numeric OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(rawOtp).digest("hex");

    const now = new Date();
    const resendAfter = new Date(now.getTime() + 60 * 1000); // 60s cooldown
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes TTL

    // 5. Upsert OTP verification document
    await OtpVerification.findOneAndUpdate(
      { email: lowerEmail },
      {
        email: lowerEmail,
        otpHash,
        registrationData: JSON.stringify(body),
        attempts: 0,
        resendAfter,
        expiresAt,
      },
      { upsert: true, new: true }
    );

    // 6. Dispatch Email
    const emailSent = await emailService.sendRegisterOtp(lowerEmail, rawOtp, name);
    if (!emailSent) {
      return NextResponse.json(
        { message: `Failed to deliver verification email to ${lowerEmail}. Please check mail server connection.` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `A 6-digit verification code has been sent to ${lowerEmail}.`,
      resendCooldownSeconds: 60,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    console.error("Send OTP error:", error);
    return NextResponse.json({ message: (error as any).message || "Failed to send verification code" }, { status: 500 });
  }
}
