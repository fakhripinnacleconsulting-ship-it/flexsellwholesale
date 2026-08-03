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

    // Update last login
    await Manager.updateOne({ _id: manager._id }, { $set: { lastLogin: new Date() } });

    // Sign token (including permissions)
    const token = signToken({
      userId: manager._id,
      email: manager.email,
      role: "manager",
      permissions: manager.permissions,
    } as any);

    await setTokenCookie(token);

    const managerObj = manager.toObject();
    delete managerObj.password;

    return NextResponse.json({
      message: "Manager logged in successfully",
      manager: managerObj,
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
