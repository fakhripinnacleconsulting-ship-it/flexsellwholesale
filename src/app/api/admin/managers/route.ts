import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET all managers
export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const managers = await Manager.find().select("-password").sort({ createdAt: -1 }).lean();
    return NextResponse.json(managers);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch managers" }, { status: 500 });
  }
}

// POST create a new manager
export async function POST(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { name, email, password, permissions, status } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required" }, { status: 400 });
    }

    const existing = await Manager.findOne({ email: email.toLowerCase() });
    if (existing) {
      return NextResponse.json({ message: "Manager email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newManager = await Manager.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      permissions: permissions || [],
      status: status || "active"
    });

    const managerObj = newManager.toObject();
    delete managerObj.password;

    return NextResponse.json(managerObj, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to create manager" }, { status: 500 });
  }
}

// PUT update an existing manager
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { _id, name, email, password, permissions, status } = await request.json();

    if (!_id) return NextResponse.json({ message: "Manager ID required" }, { status: 400 });

    const manager = await Manager.findById(_id);
    if (!manager) return NextResponse.json({ message: "Manager not found" }, { status: 404 });

    if (email && email.toLowerCase() !== manager.email) {
      const existing = await Manager.findOne({ email: email.toLowerCase() });
      if (existing) return NextResponse.json({ message: "Email already in use" }, { status: 400 });
      manager.email = email.toLowerCase();
    }

    if (name) manager.name = name;
    if (permissions) manager.permissions = permissions;
    if (status) manager.status = status;
    
    if (password) {
      manager.password = await bcrypt.hash(password, 10);
    }

    await manager.save();
    const managerObj = manager.toObject();
    delete managerObj.password;

    return NextResponse.json(managerObj);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to update manager" }, { status: 500 });
  }
}

// DELETE a manager
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "Manager ID required" }, { status: 400 });

    await Manager.findByIdAndDelete(id);
    return NextResponse.json({ message: "Manager deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to delete manager" }, { status: 500 });
  }
}
