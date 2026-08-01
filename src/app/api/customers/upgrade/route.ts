import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { validateCustomerKycRequirements } from "@/lib/kycValidationHelper";

// POST: Customer submits an upgrade request to B2B/Dropshipping
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
    const { requestedTypes, company, storeName, address, city, state, pinCode, phone, gstin, kycDocuments } = body;

    if (!requestedTypes || !Array.isArray(requestedTypes) || requestedTypes.length === 0) {
      return NextResponse.json({ message: "Requested customer types are required" }, { status: 400 });
    }

    const customer = await Customer.findById(payload.userId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (company !== undefined) customer.company = company;
    if (storeName !== undefined) customer.storeName = storeName;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pinCode !== undefined) customer.pinCode = pinCode;
    if (phone !== undefined) customer.phone = phone;
    if (gstin !== undefined) customer.gstin = gstin;

    customer.upgradeStatus = "pending";
    customer.upgradeRequestedTypes = requestedTypes;
    customer.upgradeRejectionReason = undefined;
    if (kycDocuments) customer.kycDocuments = kycDocuments;

    await customer.save();

    // Dispatch Event
    try {
      const { dispatchEvent } = await import("@/lib/events/eventDispatcher");
      await dispatchEvent({
        eventType: "ACCOUNT_UPGRADE_REQUESTED",
        category: "security",
        actor: { id: customer._id, name: customer.name, role: "customer" },
        recipient: { role: "admin" }, // Sends to admin
        entity: { type: "customer", id: customer._id },
        data: { 
          name: customer.name, 
          email: customer.email, 
          company: customer.company,
          requestedTypes
        },
      });
    } catch (err) {
      console.error("Failed to dispatch upgrade request event:", err);
    }

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to submit upgrade request" }, { status: 500 });
  }
}

// GET: Admin list pending upgrade requests
export async function GET() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const requests = await Customer.find({ upgradeStatus: "pending" }).select("-password").sort({ updatedAt: -1 });
    return NextResponse.json(requests);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch upgrade requests" }, { status: 500 });
  }
}

// PUT: Admin approve or reject upgrade request
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, action, reason } = body;

    if (!customerId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "Invalid parameters. CustomerId and action ('approve'|'reject') are required." }, { status: 400 });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (action === "approve") {
      const requested = customer.upgradeRequestedTypes || [];
      const existingTypes = customer.customerTypes || ["B2C"];
      const combined = Array.from(new Set([...existingTypes, ...requested])) as ("B2C" | "B2B" | "Dropshipping")[];

      const kycCheck = validateCustomerKycRequirements({
        customerTypes: combined,
        company: customer.company,
        storeName: customer.storeName,
        gstin: customer.gstin,
        kycDocuments: customer.kycDocuments,
      });

      if (!kycCheck.isValid) {
        return NextResponse.json({ message: kycCheck.errorMessage }, { status: 400 });
      }

      customer.customerTypes = combined;
      customer.upgradeStatus = "approved";
      customer.upgradeRejectionReason = undefined;
    } else if (action === "reject") {
      customer.upgradeStatus = "rejected";
      customer.upgradeRejectionReason = reason || "";
    }

    await customer.save();

    // Dispatch Event
    try {
      const { dispatchEvent } = await import("@/lib/events/eventDispatcher");
      await dispatchEvent({
        eventType: action === "approve" ? "ACCOUNT_UPGRADE_APPROVED" : "ACCOUNT_UPGRADE_REJECTED",
        category: "security",
        actor: { id: payload.userId, name: "Admin", role: "admin" },
        recipient: { customerId: customer._id, email: customer.email, name: customer.name, role: "customer" },
        entity: { type: "customer", id: customer._id },
        data: { 
          name: customer.name, 
          email: customer.email, 
          newTypes: action === "approve" ? customer.customerTypes : undefined,
          reason: action === "reject" ? reason : undefined
        },
      });
    } catch (err) {
      console.error("Failed to dispatch upgrade decision event:", err);
    }

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to process upgrade decision" }, { status: 500 });
  }
}
