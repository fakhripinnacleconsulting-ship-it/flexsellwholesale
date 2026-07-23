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
    const { name, email, password, company, address, city, state, pinCode, phone, gstin, customerTypes } = validatedData;

    // Check if email already exists
    const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
    if (existingCustomer) {
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

    const newCustomer = new Customer({
      _id: customerId,
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "customer",
      company: company || "",
      address,
      city,
      state,
      pinCode,
      phone,
      initials,
      gstin: gstin || "",
      customerTypes: customerTypes || ["B2C"],
    });

    await newCustomer.save();

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
    console.error("Register error:", error);
    return NextResponse.json({ message: (error as any).message || "Registration failed" }, { status: 500 });
  }
}
