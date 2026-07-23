import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Collection from "@/models/Collection";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await dbConnect();
    const { slug } = await params;
    
    const collection = await Collection.findOne({ slug });
    if (!collection) {
      return NextResponse.json({ message: "Collection not found" }, { status: 404 });
    }
    
    return NextResponse.json(collection);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch collection by slug" }, { status: 500 });
  }
}
