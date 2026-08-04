import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { generateNextId } from "@/lib/idGeneratorServer";
import { emailService } from "@/lib/emailService";

// GET: Fetch all Admin accounts
export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const admins = await Customer.find({ role: "admin" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(admins);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch admin accounts" }, { status: 500 });
  }
}

// POST: Create a new Admin account
export async function POST(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { name, email, password, phone, company } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email is already registered
    const existing = await Customer.findOne({ email: normalizedEmail });
    if (existing) {
      if (existing.role === "admin") {
        return NextResponse.json({ message: "An admin account already exists with this email" }, { status: 400 });
      } else {
        // Upgrade existing customer account to admin
        const hashedPassword = await bcrypt.hash(password, 10);
        existing.role = "admin";
        existing.name = name;
        existing.password = hashedPassword;
        if (phone) existing.phone = phone;
        if (company) existing.company = company;
        await existing.save();

        const updatedObj = existing.toObject();
        delete updatedObj.password;

        emailService.sendAdminWelcomeEmail(updatedObj, password).catch((err) => {
          console.error("Failed to send admin welcome email:", err);
        });

        return NextResponse.json(updatedObj, { status: 200 });
      }
    }

    const newId = await generateNextId("customer");
    const hashedPassword = await bcrypt.hash(password, 10);

    const initials = name
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "SA";

    const newAdmin = await Customer.create({
      _id: newId,
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
      phone: phone || "",
      company: company || "Executive Management",
      initials,
      customerTypes: ["B2B"],
    });

    const adminObj = newAdmin.toObject();
    delete adminObj.password;

    // Send welcome email with login credentials
    emailService.sendAdminWelcomeEmail(adminObj, password).catch((err) => {
      console.error("Failed to send admin welcome email:", err);
    });

    return NextResponse.json(adminObj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to create admin account" }, { status: 500 });
  }
}

// PUT: Update an existing Admin account
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { _id, name, email, password, phone, company } = await request.json();

    if (!_id) return NextResponse.json({ message: "Admin ID required" }, { status: 400 });

    const adminDoc = await Customer.findById(_id);
    if (!adminDoc || adminDoc.role !== "admin") {
      return NextResponse.json({ message: "Admin account not found" }, { status: 404 });
    }

    if (email && email.trim().toLowerCase() !== adminDoc.email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await Customer.findOne({ email: normalizedEmail, _id: { $ne: _id } });
      if (existing) return NextResponse.json({ message: "Email is already in use by another account" }, { status: 400 });
      adminDoc.email = normalizedEmail;
    }

    if (name) adminDoc.name = name;
    if (phone !== undefined) adminDoc.phone = phone;
    if (company !== undefined) adminDoc.company = company;

    if (password && password.trim().length > 0) {
      adminDoc.password = await bcrypt.hash(password.trim(), 10);
    }

    await adminDoc.save();
    const adminObj = adminDoc.toObject();
    delete adminObj.password;

    return NextResponse.json(adminObj);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update admin account" }, { status: 500 });
  }
}

// DELETE: Delete an Admin account
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Admin ID required" }, { status: 400 });

    // Self-deletion protection
    if (payload.userId === id) {
      return NextResponse.json({ message: "You cannot delete your own admin account while logged in." }, { status: 400 });
    }

    // Check if at least one admin remains
    const adminCount = await Customer.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return NextResponse.json({ message: "Cannot delete the last remaining Admin account." }, { status: 400 });
    }

    await Customer.findByIdAndDelete(id);
    return NextResponse.json({ message: "Admin account deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to delete admin account" }, { status: 500 });
  }
}
