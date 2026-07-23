import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Collection from "@/models/Collection";
import { requireAuth } from "@/lib/authGuard";
import { collectionSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;
    
    const collection = await Collection.findById(id);
    if (!collection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
    
    return NextResponse.json(collection);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch collection" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const { id } = await params;
    const body = await request.json();
    
    const validatedData = collectionSchema.partial().parse(body);
    
    const updatedCollection = await Collection.findByIdAndUpdate(
      id,
      { $set: validatedData },
      { new: true, runValidators: true }
    );
    
    if (!updatedCollection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
    
    return NextResponse.json(updatedCollection);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: error.message || "Failed to update collection" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const { id } = await params;
    
    const deletedCollection = await Collection.findByIdAndDelete(id);
    if (!deletedCollection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
    
    return NextResponse.json({ message: "Collection deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to delete collection" }, { status: 500 });
  }
}
