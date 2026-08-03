import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";
import { resetPasswordSchema } from "@/lib/validators";
import { ZodError } from "zod";

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
    const validatedData = resetPasswordSchema.parse(body);
    const { token, password: newPassword } = validatedData;

    // forgot-password stores only the SHA-256 of the token it emailed, so hash the incoming
    // one to look it up.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const customer = await Customer.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!customer) {
      return NextResponse.json({ message: "Invalid or expired password reset token" }, { status: 400 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Save and clear token
    customer.password = hashedPassword;
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpires = undefined;

    await customer.save();

    return NextResponse.json({ message: "Password reset successfully" });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    console.error("Reset password error:", error);
    return NextResponse.json({ message: (error as any).message || "Failed to reset password" }, { status: 500 });
  }
}
