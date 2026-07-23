import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Collection from "@/models/Collection";
import { requireAuth } from "@/lib/authGuard";
import { collectionSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const url = new URL(request.url);
    const featured = url.searchParams.get("featured");
    const activeOnly = url.searchParams.get("activeOnly");

    const query: any = {};
    if (featured === "true") {
      query.isFeatured = true;
    }
    if (activeOnly === "true") {
      query.isActive = true;
    }

    const collections = await Collection.find(query).sort({ order: 1 });
    return NextResponse.json(collections);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch collections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const body = await request.json();
    const validatedData = collectionSchema.parse(body) as any;

    if (!validatedData._id) {
      validatedData._id = "col_" + Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
    }

    const newCollection = await Collection.create(validatedData);
    return NextResponse.json(newCollection, { status: 201 });
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to create collection" }, { status: 500 });
  }
}
