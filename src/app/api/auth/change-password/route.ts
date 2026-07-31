import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/authGuard";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: "Current and new password are required." }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ message: "New password must be at least 8 characters long." }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (!customer.password) {
      return NextResponse.json({ message: "This account logs in via Google and has no password to change." }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(currentPassword, customer.password);
    if (!isMatch) {
      return NextResponse.json({ message: "Current password is incorrect." }, { status: 401 });
    }

    customer.password = await bcrypt.hash(newPassword, 10);
    await customer.save();

    return NextResponse.json({ message: "Password changed successfully." });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to change password" }, { status: 500 });
  }
}
