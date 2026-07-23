import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
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

    const trimmedIdentifier = identifier.trim();

    // Query by email OR _id (e.g. FSW-0001)
    const customer = await Customer.findOne({
      $or: [
        { email: trimmedIdentifier.toLowerCase() },
        { _id: trimmedIdentifier.toUpperCase() }
      ]
    });

    if (!customer) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Google-only users might not have a password set
    if (!customer.password) {
      return NextResponse.json({ message: "This account logs in via Google. Please use Google Sign-In." }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Sign token
    const token = signToken({
      userId: customer._id,
      email: customer.email,
      role: customer.role || "customer",
    });

    await setTokenCookie(token);

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json({
      message: "Logged in successfully",
      customer: customerObj,
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    console.error("Login API error:", error);
    return NextResponse.json({ message: (error as any).message || "Login failed" }, { status: 500 });
  }
}
