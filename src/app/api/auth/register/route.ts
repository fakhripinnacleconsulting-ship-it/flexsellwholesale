import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";
import { signToken, setTokenCookie } from "@/lib/auth";
import { dispatchWebhook } from "@/lib/webhookDispatcher";
import { generateNextId } from "@/lib/idGeneratorServer";
import { rateLimit } from "@/lib/rateLimit";
import { registerSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function POST(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0] : "127.0.0.1";
  try {
    await rateLimit(ip);
  } catch (err) {
    return NextResponse.json({ message: "Too many registration attempts. Try again later." }, { status: 429 });
  }

  try {
    await dbConnect();
    const body = await req.json();
    const validatedData = registerSchema.parse(body);
    const { name, email, password, company, storeName, address, city, state, pinCode, phone, gstin, customerTypes, kycDocuments, otp } = body;

    // Enforce OTP Verification to prevent registration bypass
    if (!otp || typeof otp !== "string" || !otp.trim()) {
      return NextResponse.json(
        { message: "OTP verification code is required to complete registration." },
        { status: 400 }
      );
    }

    const lowerEmail = email.toLowerCase().trim();

    // Check OTP record in OtpVerification model
    const OtpVerification = (await import("@/models/OtpVerification")).default;
    const otpRecord = await OtpVerification.findOne({ email: lowerEmail });
    if (!otpRecord) {
      return NextResponse.json(
        { message: "Verification code expired or not found. Please request a new verification code." },
        { status: 400 }
      );
    }

    if (otpRecord.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json(
        { message: "Verification code has expired. Please request a new code." },
        { status: 400 }
      );
    }

    const crypto = await import("crypto");
    const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    if (inputHash !== otpRecord.otpHash) {
      otpRecord.attempts = (otpRecord.attempts || 0) + 1;
      await otpRecord.save();
      return NextResponse.json(
        { message: "Invalid verification code." },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingCustomer = await Customer.findOne({ email: lowerEmail });
    if (existingCustomer) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "Email is already registered" }, { status: 400 });
    }

    // Find next customer ID (FSW-000x or custom format)
    const customerId = await generateNextId("customer");

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Initials
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "C";

    const hasB2bOrDropship = customerTypes?.some((t) => t === "B2B" || t === "Dropshipping");
    const requestedTypes = (customerTypes || []).filter((t) => t === "B2B" || t === "Dropshipping") as ("B2B" | "Dropshipping")[];

    const newCustomer = new Customer({
      _id: customerId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "customer",
      company: company || "",
      storeName: storeName || "",
      address,
      city,
      state,
      pinCode,
      phone,
      initials,
      gstin: gstin || "",
      // Customer is created as B2C initial if upgrade is pending, or customerTypes as requested if approved
      customerTypes: hasB2bOrDropship ? ["B2C"] : (customerTypes || ["B2C"]),
      upgradeStatus: hasB2bOrDropship ? "pending" : "none",
      upgradeRequestedTypes: hasB2bOrDropship ? requestedTypes : [],
      kycDocuments: kycDocuments || {}
    });

    await newCustomer.save();

    // Clean up used OTP verification record
    await OtpVerification.deleteOne({ email: lowerEmail });

    // Dispatch Centralized Event (Triggers Welcome Email & Notification)
    try {
      const { dispatchEvent } = await import("@/lib/events/eventDispatcher");
      dispatchEvent({
        eventType: "AUTH_REGISTERED",
        category: "security",
        actor: { id: customerId, name, role: "customer" },
        recipient: { customerId, email: newCustomer.email, name, role: "both" },
        entity: { type: "customer", id: customerId },
        data: { name, email: newCustomer.email, company: company || "" },
      });
    } catch (err) {
      console.error("Failed to dispatch AUTH_REGISTERED event:", err);
    }

    // Dispatch Webhook and in-app Notification asynchronously
    dispatchWebhook("customer.created", {
      _id: customerId,
      name,
      email: newCustomer.email,
      company: newCustomer.company,
      phone: newCustomer.phone
    }, customerId, {
      title: "Welcome to Flexsell Wholesale!",
      message: `Thank you for registering. Your B2B wholesale portal account is now active. ID: ${customerId}`,
      type: "success"
    }).catch(console.error);

    // Create session
    const token = signToken({
      userId: customerId,
      email: newCustomer.email,
      role: newCustomer.role,
      customerTypes: newCustomer.customerTypes,
    });

    await setTokenCookie(token);

    // Remove password
    const customerObj = newCustomer.toObject();
    delete customerObj.password;

    return NextResponse.json({
      message: "Customer registered successfully",
      customer: customerObj,
    }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message || "Validation failed";
      return NextResponse.json({ message: firstError }, { status: 400 });
    }
    const errMsg = error instanceof Error ? error.message : "Registration failed";
    return NextResponse.json({ message: errMsg }, { status: 500 });
  }
}
