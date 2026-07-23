import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    const customer = await Customer.findById(payload.userId).select("-password").lean();
    if (!customer) {
      const response = NextResponse.json({ message: "Session expired or user deleted" }, { status: 401 });
      response.cookies.delete("token");
      return response;
    }

    return NextResponse.json(customer);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch active customer" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ message: "Invalid session" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, company, gstin, address, city, state, pinCode, email, wishlist, customerTypes } = body;

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      const response = NextResponse.json({ message: "Session expired or user deleted" }, { status: 401 });
      response.cookies.delete("token");
      return response;
    }

    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (company !== undefined) customer.company = company;
    if (gstin !== undefined) customer.gstin = gstin;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pinCode !== undefined) customer.pinCode = pinCode;
    if (email !== undefined) customer.email = email.toLowerCase();
    if (wishlist !== undefined) customer.wishlist = wishlist;
    if (customerTypes !== undefined) customer.customerTypes = customerTypes;

    // Recalculate initials if name changed
    if (name) {
      const parts = name.trim().split(/\s+/);
      const initials = (parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "");
      customer.initials = initials.toUpperCase().substring(0, 2) || "U";
    }

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update profile" }, { status: 500 });
  }
}
