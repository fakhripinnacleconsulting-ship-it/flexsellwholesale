import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Category from "@/models/Category";
import { requireAuth } from "@/lib/authGuard";
import { categorySchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function GET() {
  try {
    await dbConnect();
    const categories = await Category.find({}).sort({ order: 1 });
    return NextResponse.json(categories);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const body = await request.json();
    
    const validatedData = categorySchema.parse(body) as any;
    
    // Generate a random ObjectId-like 24-character hex ID if not provided
    if (!validatedData._id) {
      validatedData._id = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    }
    
    const newCategory = await Category.create(validatedData);
    return NextResponse.json(newCategory, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to create category" }, { status: 500 });
  }
}
