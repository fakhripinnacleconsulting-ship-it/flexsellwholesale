import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import mongoose from "mongoose";

// GET: Retrieve all saved addresses for the authenticated customer
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

    const customer = await Customer.findById(payload.userId).select("addresses").lean();
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(customer.addresses || []);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch addresses" }, { status: 500 });
  }
}

// POST: Add a new saved address
export async function POST(request: Request) {
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
    const { name, firstName, lastName, company, address, apartment, city, state, pinCode, phone, gstin, isDefault } = body;

    if (!name || !firstName || !lastName || !address || !city || !state || !pinCode || !phone) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (!customer.addresses) {
      customer.addresses = [];
    }

    // Generate unique ID for the address
    const newAddressId = new mongoose.Types.ObjectId().toString();

    // If isDefault is true, set all other addresses to false
    if (isDefault) {
      customer.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    const newAddress = {
      _id: newAddressId,
      name,
      firstName,
      lastName,
      company: company || "",
      address,
      apartment: apartment || "",
      city,
      state,
      pinCode,
      phone,
      gstin: gstin || "",
      isDefault: isDefault || false
    };

    customer.addresses.push(newAddress);

    // If it's the first address, make it default automatically
    if (customer.addresses.length === 1) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();

    return NextResponse.json(customer.addresses);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to add address" }, { status: 500 });
  }
}

// PUT: Edit an existing address or set default
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
    const { _id, name, firstName, lastName, company, address, apartment, city, state, pinCode, phone, gstin, isDefault } = body;

    if (!_id) {
      return NextResponse.json({ message: "Address ID is required" }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const addrIndex = customer.addresses.findIndex((addr: any) => addr._id.toString() === _id.toString());
    if (addrIndex === -1) {
      return NextResponse.json({ message: "Address not found" }, { status: 404 });
    }

    // Set other addresses isDefault to false if this one is being set to true
    if (isDefault) {
      customer.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });
    }

    const currentAddr = customer.addresses[addrIndex];
    if (name !== undefined) currentAddr.name = name;
    if (firstName !== undefined) currentAddr.firstName = firstName;
    if (lastName !== undefined) currentAddr.lastName = lastName;
    if (company !== undefined) currentAddr.company = company;
    if (address !== undefined) currentAddr.address = address;
    if (apartment !== undefined) currentAddr.apartment = apartment;
    if (city !== undefined) currentAddr.city = city;
    if (state !== undefined) currentAddr.state = state;
    if (pinCode !== undefined) currentAddr.pinCode = pinCode;
    if (phone !== undefined) currentAddr.phone = phone;
    if (gstin !== undefined) currentAddr.gstin = gstin;
    if (isDefault !== undefined) currentAddr.isDefault = isDefault;

    await customer.save();

    return NextResponse.json(customer.addresses);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update address" }, { status: 500 });
  }
}

// DELETE: Delete a saved address
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ message: "Address ID is required" }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const addrIndex = customer.addresses.findIndex((addr: any) => addr._id.toString() === id.toString());
    if (addrIndex === -1) {
      return NextResponse.json({ message: "Address not found" }, { status: 404 });
    }

    const removedAddress = customer.addresses[addrIndex];
    customer.addresses.splice(addrIndex, 1);

    // If we deleted the default address, make the first remaining address default
    if (removedAddress.isDefault && customer.addresses.length > 0) {
      customer.addresses[0].isDefault = true;
    }

    await customer.save();

    return NextResponse.json(customer.addresses);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete address" }, { status: 500 });
  }
}
