import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import OtpVerification from "@/models/OtpVerification";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { signToken, setTokenCookie } from "@/lib/auth";
import { generateNextId } from "@/lib/idGeneratorServer";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and verification code are required." }, { status: 400 });
    }

    const lowerEmail = email.toLowerCase().trim();

    // 1. Find OTP record
    const otpRecord = await OtpVerification.findOne({ email: lowerEmail });
    if (!otpRecord) {
      return NextResponse.json({ message: "Verification code expired or not found. Please request a new code." }, { status: 400 });
    }

    // 2. Check expiration
    if (otpRecord.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "Verification code has expired. Please request a new code." }, { status: 400 });
    }

    // 3. Check attempt limit (max 5)
    if (otpRecord.attempts >= 5) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "Maximum verification attempts exceeded. Please request a new code." }, { status: 400 });
    }

    // 4. Verify SHA-256 hash
    const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
    if (inputHash !== otpRecord.otpHash) {
      otpRecord.attempts += 1;
      await otpRecord.save();
      const remaining = 5 - otpRecord.attempts;
      return NextResponse.json(
        { message: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` },
        { status: 400 }
      );
    }

    // 5. Parse registered buyer draft data
    const draftData = JSON.parse(otpRecord.registrationData);
    const { name, password, company, address, city, state, pinCode, phone, gstin, customerTypes } = draftData;

    // Check if email registered during the verification window
    const existing = await Customer.findOne({ email: lowerEmail });
    if (existing) {
      await OtpVerification.deleteOne({ email: lowerEmail });
      return NextResponse.json({ message: "An account with this email address is already registered." }, { status: 400 });
    }

    // 6. Generate Customer ID & hash password
    const customerId = await generateNextId("customer");
    const hashedPassword = await bcrypt.hash(password, 10);
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "C";

    // 7. Auto-populate initial saved address if physical address was provided
    const initialAddresses = (address && city && state && pinCode) ? [{
      name: company || name || "Default Address",
      firstName: name.split(" ")[0] || "",
      lastName: name.split(" ").slice(1).join(" ") || "",
      company: company || "",
      address,
      city,
      state,
      pinCode,
      phone: phone || "",
      gstin: gstin || "",
      isDefault: true
    }] : [];

    // Create Customer
    const newCustomer = new Customer({
      _id: customerId,
      name,
      email: lowerEmail,
      password: hashedPassword,
      role: "customer",
      company: company || "",
      address: address || "",
      city: city || "",
      state: state || "",
      pinCode: pinCode || "",
      phone,
      initials,
      gstin: gstin || "",
      customerTypes: customerTypes || ["B2C"],
      addresses: initialAddresses,
    });

    await newCustomer.save();

    // 8. Delete OTP verification record (Cleanup)
    await OtpVerification.deleteOne({ email: lowerEmail });

    // 9. Dispatch Centralized Event
    dispatchEvent({
      eventType: "AUTH_REGISTERED",
      category: "security",
      actor: { id: customerId, name, role: "customer" },
      recipient: { customerId, email: lowerEmail, name, role: "both" },
      entity: { type: "customer", id: customerId },
      data: { name, email: lowerEmail, company: company || "" },
    });

    // 10. Create Session
    const token = signToken({
      userId: customerId,
      email: newCustomer.email,
      role: newCustomer.role,
      customerTypes: newCustomer.customerTypes,
    });

    await setTokenCookie(token);

    const customerObj = newCustomer.toObject();
    delete customerObj.password;

    return NextResponse.json(
      {
        message: "Email verified & account registered successfully!",
        customer: customerObj,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Verify OTP error:", error);
    return NextResponse.json({ message: (error as any).message || "Verification failed" }, { status: 500 });
  }
}
