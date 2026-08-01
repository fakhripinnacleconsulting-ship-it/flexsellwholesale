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
    const { name, phone, company, storeName, gstin, address, city, state, pinCode, email, wishlist, customerTypes, upgradeStatus, upgradeRequestedTypes, kycDocuments } = body;

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      const response = NextResponse.json({ message: "Session expired or user deleted" }, { status: 401 });
      response.cookies.delete("token");
      return response;
    }

    const updatedFields: string[] = [];
    if (name !== undefined && name !== customer.name) updatedFields.push(`Name changed to: "${name}"`);
    if (phone !== undefined && phone !== customer.phone) updatedFields.push(`Phone changed to: "${phone}"`);
    if (company !== undefined && company !== customer.company) updatedFields.push(`Company Name changed to: "${company}"`);
    if (storeName !== undefined && storeName !== customer.storeName) updatedFields.push(`Store Name changed to: "${storeName}"`);
    if (gstin !== undefined && gstin !== customer.gstin) updatedFields.push(`GSTIN changed to: "${gstin}"`);
    if (address !== undefined && address !== customer.address) updatedFields.push(`Address changed to: "${address}"`);
    if (city !== undefined && city !== customer.city) updatedFields.push(`City changed to: "${city}"`);
    if (state !== undefined && state !== customer.state) updatedFields.push(`State changed to: "${state}"`);
    if (pinCode !== undefined && pinCode !== customer.pinCode) updatedFields.push(`PIN Code changed to: "${pinCode}"`);

    if (name !== undefined) customer.name = name;
    if (phone !== undefined) customer.phone = phone;
    if (company !== undefined) customer.company = company;
    if (storeName !== undefined) customer.storeName = storeName;
    if (gstin !== undefined) customer.gstin = gstin;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pinCode !== undefined) customer.pinCode = pinCode;
    if (email !== undefined) customer.email = email.toLowerCase();
    if (wishlist !== undefined) customer.wishlist = wishlist;
    if (customerTypes !== undefined) customer.customerTypes = customerTypes;
    if (upgradeStatus !== undefined) customer.upgradeStatus = upgradeStatus;
    if (upgradeRequestedTypes !== undefined) customer.upgradeRequestedTypes = upgradeRequestedTypes;
    if (kycDocuments !== undefined) customer.kycDocuments = kycDocuments;

    // Recalculate initials if name changed
    if (name) {
      const parts = name.trim().split(/\s+/);
      const initials = (parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "");
      customer.initials = initials.toUpperCase().substring(0, 2) || "U";
    }

    await customer.save();

    if (updatedFields.length > 0) {
      try {
        const { dispatchEvent } = await import("@/lib/events/eventDispatcher");
        await dispatchEvent({
          eventType: "PROFILE_UPDATED",
          category: "security",
          actor: { id: customer._id.toString(), name: customer.name, role: "customer" },
          recipient: { customerId: customer._id.toString(), email: customer.email, name: customer.name, role: "both" },
          entity: { type: "customer", id: customer._id.toString() },
          data: {
            updatedFields,
            changesSummary: `Updated profile details: ${updatedFields.join(", ")}`
          }
        });
      } catch {
        // non-blocking
      }
    }

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update profile" }, { status: 500 });
  }
}

