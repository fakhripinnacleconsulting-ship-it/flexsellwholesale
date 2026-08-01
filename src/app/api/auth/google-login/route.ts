import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { signToken, setTokenCookie } from "@/lib/auth";
import { generateNextId } from "@/lib/idGeneratorServer";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ message: "Google ID token is required" }, { status: 400 });
    }

    // Verify token using Google OAuth tokeninfo endpoint
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    if (!response.ok) {
      return NextResponse.json({ message: "Invalid Google token" }, { status: 400 });
    }

    const payload = await response.json();

    // Verify audience. No hardcoded fallback: an unset client ID must fail closed,
    // otherwise a token minted for someone else's project would be accepted.
    const validClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    ].filter(Boolean);

    if (validClientIds.length === 0) {
      console.error("Google login rejected: GOOGLE_CLIENT_ID is not configured.");
      return NextResponse.json({ message: "Google Sign-In is not configured on this server" }, { status: 500 });
    }

    if (!validClientIds.includes(payload.aud)) {
      return NextResponse.json({ message: "Token client ID mismatch" }, { status: 400 });
    }

    const email = payload.email?.toLowerCase();
    if (!email) {
      return NextResponse.json({ message: "Email not provided by Google" }, { status: 400 });
    }

    // Find or create customer
    let customer = await Customer.findOne({ email });

    if (!customer) {
      // Find next customer ID (FSW-000x or custom format)
      const customerId = await generateNextId("customer");

      // Initials
      const initials = (payload.given_name?.[0] || "") + (payload.family_name?.[0] || "");
      const finalInitials = initials.toUpperCase().substring(0, 2) || "G";

      customer = new Customer({
        _id: customerId,
        name: payload.name || "Google Buyer",
        email: email,
        role: "customer",
        company: "",
        address: "",
        city: "",
        state: "",
        pinCode: "",
        phone: "",
        initials: finalInitials,
        gstin: "",

      });

      await customer.save();
    }

    // Create session
    const token = signToken({
      userId: customer._id,
      email: customer.email,
      role: customer.role || "customer",
    });

    await setTokenCookie(token);

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json({
      message: "Logged in via Google successfully",
      customer: customerObj,
    });
  } catch (error: unknown) {
    console.error("Google Login API error:", error);
    return NextResponse.json({ message: (error as any).message || "Google Authentication failed" }, { status: 500 });
  }
}
