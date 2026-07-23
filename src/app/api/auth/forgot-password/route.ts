import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { forgotPasswordSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { emailService } from "@/lib/emailService";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    try {
      await rateLimit(ip);
    } catch (err) {
      return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
    }

    await dbConnect();
    const body = await req.json();
    const validatedData = forgotPasswordSchema.parse(body);
    const { email } = validatedData;

    const customer = await Customer.findOne({ email: email.toLowerCase() });

    // Success response for security (prevents user enumeration)
    const successResponse = {
      message: "If that email is registered, we have sent a password reset link."
    };

    if (!customer) {
      return NextResponse.json(successResponse);
    }

    // Generate token
    const token = crypto.randomBytes(32).toString("hex");
    customer.resetPasswordToken = token;
    customer.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await customer.save();

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password?token=${token}`;

    // Always log the reset link in development mode for easy testing
    if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
      console.log("\n=======================================================");
      console.log("DEVELOPMENT RESET LINK FOR EMAIL:", customer.email);
      console.log(resetUrl);
      console.log("=======================================================\n");
    }

    const emailSent = await emailService.sendPasswordResetEmail(customer.email, resetUrl);
    if (!emailSent) {
      return NextResponse.json({
        message: "Failed to deliver reset email. If in development, check terminal console for generated reset link."
      }, { status: 500 });
    }

    return NextResponse.json(successResponse);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    console.error("Forgot password error:", error);
    return NextResponse.json({ message: (error as any).message || "Failed to process forgot password" }, { status: 500 });
  }
}
