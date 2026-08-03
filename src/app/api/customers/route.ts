import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { generateNextId } from "@/lib/idGeneratorServer";
import { validateCustomerKycRequirements } from "@/lib/kycValidationHelper";
import { escapeRegex } from "@/lib/utils";

// GET: Fetch all customers (restricted to admins)
export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");
    const search = searchParams.get("search") || searchParams.get("q");
    const requestedCustomerType = searchParams.get("customerType");

    const query: any = { role: { $ne: "admin" } };
    
    if (requestedCustomerType) {
      query.customerTypes = requestedCustomerType;
    }
    
    if (payload.role === "manager") {
      const perms = (payload as any).permissions || [];
      const hasInvoiceOrOrderPerms = perms.some((p: string) => p.startsWith("invoices_") || p.startsWith("orders_"));
      
      const hasB2C = perms.includes("customers_b2c") || perms.some((p: string) => p.startsWith("customers_b2c:")) || hasInvoiceOrOrderPerms;
      const hasB2B = perms.includes("customers_b2b") || perms.some((p: string) => p.startsWith("customers_b2b:")) || hasInvoiceOrOrderPerms;
      const hasDrop = perms.includes("customers_dropshipping") || perms.some((p: string) => p.startsWith("customers_dropshipping:") || p.startsWith("customers_dropship:")) || hasInvoiceOrOrderPerms;

      if (!hasB2C && !hasB2B && !hasDrop) {
        return NextResponse.json({ message: "Forbidden: No customer access" }, { status: 403 });
      }

      const allowedTypes = [];
      if (hasB2C) allowedTypes.push("B2C");
      if (hasB2B) allowedTypes.push("B2B");
      if (hasDrop) allowedTypes.push("Dropshipping");

      if (requestedCustomerType) {
         if (!allowedTypes.includes(requestedCustomerType)) {
            return NextResponse.json({ message: "Forbidden: You do not have access to this customer type" }, { status: 403 });
         }
      } else if (allowedTypes.length < 3) {
        query.customerTypes = { $in: allowedTypes };
      }
    }
    if (search) {
      // Escaped: a search box otherwise feeds arbitrary regex to Mongo, so "(((" crashes the
      // query and a nested-quantifier pattern pins the server on backtracking.
      const regex = new RegExp(escapeRegex(search.trim()), "i");
      query.$or = [
        { _id: regex },
        { name: regex },
        { email: regex },
        { company: regex },
        { gstin: regex },
        { phone: regex }
      ];
    }

    if (page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      const skip = (pageNum - 1) * limitNum;

      const [customers, total] = await Promise.all([
        Customer.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Customer.countDocuments(query)
      ]);

      return NextResponse.json({
        customers,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
      });
    }

    // Filter out admin accounts
    const customers = await Customer.find(query).select("-password").sort({ createdAt: -1 });
    return NextResponse.json(customers);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch customers" }, { status: 500 });
  }
}

// POST: Admin creates a new B2B customer account
export async function POST(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, password, company, storeName, address, city, state, pinCode, phone, gstin, customerTypes, kycDocuments } = body;

    if (payload.role === "manager") {
      const perms = (payload as any).permissions || [];
      const cTypes = customerTypes || ["B2C"];
      const hasB2C = perms.includes("customers_b2c") || perms.includes("customers_b2c:create");
      const hasB2B = perms.includes("customers_b2b") || perms.includes("customers_b2b:create");
      const hasDrop = perms.includes("customers_dropshipping") || perms.includes("customers_dropship:create") || perms.includes("customers_dropshipping:create");
      
      for (const t of cTypes) {
        if (t === "B2C" && !hasB2C) return NextResponse.json({ message: "Forbidden: Cannot create B2C customers" }, { status: 403 });
        if (t === "B2B" && !hasB2B) return NextResponse.json({ message: "Forbidden: Cannot create B2B customers" }, { status: 403 });
        if (t === "Dropshipping" && !hasDrop) return NextResponse.json({ message: "Forbidden: Cannot create Dropshipping customers" }, { status: 403 });
      }
    }

    if (!name || !email || !password || !address || !city || !state || !pinCode || !phone) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Validate KYC document and business field requirements for B2B / Dropshipping
    const kycCheck = validateCustomerKycRequirements({
      customerTypes: customerTypes || ["B2C"],
      company,
      storeName,
      gstin,
      kycDocuments: kycDocuments || {},
    });
    if (!kycCheck.isValid) {
      return NextResponse.json({ message: kycCheck.errorMessage }, { status: 400 });
    }

    // Check if email already exists
    const existing = await Customer.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ message: "Email is already registered" }, { status: 400 });
    }

    // Determine sequential customer ID (FSW-000x or custom format)
    const customerId = await generateNextId("customer");

    const hashedPassword = await bcrypt.hash(password, 10);
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2) || "C";

    const newCustomer = await Customer.create({
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
      customerTypes: customerTypes || ["B2C"],
      kycDocuments: kycDocuments || {}
    });

    const customerObj = newCustomer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to create customer" }, { status: 500 });
  }
}

// PUT: Admin updates customer details
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { _id, name, email, password, company, storeName, address, city, state, pinCode, phone, gstin, customerTypes, kycDocuments } = body;

    if (!_id) {
      return NextResponse.json({ message: "Customer ID is required" }, { status: 400 });
    }

    const customer = await Customer.findById(_id);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (payload.role === "manager") {
      const perms = (payload as any).permissions || [];
      const cTypes = customer.customerTypes || ["B2C"];
      const hasB2C = perms.includes("customers_b2c") || perms.includes("customers_b2c:update");
      const hasB2B = perms.includes("customers_b2b") || perms.includes("customers_b2b:update");
      const hasDrop = perms.includes("customers_dropshipping") || perms.includes("customers_dropship:update") || perms.includes("customers_dropshipping:update");
      
      for (const t of cTypes) {
        if (t === "B2C" && !hasB2C) return NextResponse.json({ message: "Forbidden: Cannot edit this B2C customer" }, { status: 403 });
        if (t === "B2B" && !hasB2B) return NextResponse.json({ message: "Forbidden: Cannot edit this B2B customer" }, { status: 403 });
        if (t === "Dropshipping" && !hasDrop) return NextResponse.json({ message: "Forbidden: Cannot edit this Dropshipping customer" }, { status: 403 });
      }
    }

    // Validate KYC document and business field requirements for B2B / Dropshipping
    const targetTypes = customerTypes !== undefined ? customerTypes : customer.customerTypes;
    const targetCompany = company !== undefined ? company : customer.company;
    const targetStoreName = storeName !== undefined ? storeName : customer.storeName;
    const targetGstin = gstin !== undefined ? gstin : customer.gstin;
    const targetKycDocs = kycDocuments !== undefined ? kycDocuments : customer.kycDocuments;

    const kycCheck = validateCustomerKycRequirements({
      customerTypes: targetTypes,
      company: targetCompany,
      storeName: targetStoreName,
      gstin: targetGstin,
      kycDocuments: targetKycDocs,
    });
    if (!kycCheck.isValid) {
      return NextResponse.json({ message: kycCheck.errorMessage }, { status: 400 });
    }

    if (email && email.toLowerCase() !== customer.email) {
      const existing = await Customer.findOne({ email: email.toLowerCase() });
      if (existing) {
        return NextResponse.json({ message: "Email is already in use" }, { status: 400 });
      }
      customer.email = email.toLowerCase();
    }

    if (name !== undefined) {
      customer.name = name;
      customer.initials = name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2) || "C";
    }

    if (password) {
      customer.password = await bcrypt.hash(password, 10);
    }

    if (company !== undefined) customer.company = company;
    if (storeName !== undefined) customer.storeName = storeName;
    if (address !== undefined) customer.address = address;
    if (city !== undefined) customer.city = city;
    if (state !== undefined) customer.state = state;
    if (pinCode !== undefined) customer.pinCode = pinCode;
    if (phone !== undefined) customer.phone = phone;
    if (gstin !== undefined) customer.gstin = gstin;
    if (customerTypes !== undefined) customer.customerTypes = customerTypes;
    if (kycDocuments !== undefined) customer.kycDocuments = kycDocuments;

    await customer.save();

    const customerObj = customer.toObject();
    delete customerObj.password;

    return NextResponse.json(customerObj);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update customer" }, { status: 500 });
  }
}

// DELETE: Admin deletes a customer permanently
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== "admin" && payload.role !== "manager")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ message: "Customer ID is required" }, { status: 400 });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    if (payload.role === "manager") {
      const perms = (payload as any).permissions || [];
      const cTypes = customer.customerTypes || ["B2C"];
      const hasB2C = perms.includes("customers_b2c") || perms.includes("customers_b2c:delete");
      const hasB2B = perms.includes("customers_b2b") || perms.includes("customers_b2b:delete");
      const hasDrop = perms.includes("customers_dropshipping") || perms.includes("customers_dropship:delete") || perms.includes("customers_dropshipping:delete");
      
      for (const t of cTypes) {
        if (t === "B2C" && !hasB2C) return NextResponse.json({ message: "Forbidden: Cannot delete this B2C customer" }, { status: 403 });
        if (t === "B2B" && !hasB2B) return NextResponse.json({ message: "Forbidden: Cannot delete this B2B customer" }, { status: 403 });
        if (t === "Dropshipping" && !hasDrop) return NextResponse.json({ message: "Forbidden: Cannot delete this Dropshipping customer" }, { status: 403 });
      }
    }

    await Customer.findByIdAndDelete(id);

    return NextResponse.json({ message: "Customer deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete customer" }, { status: 500 });
  }
}
