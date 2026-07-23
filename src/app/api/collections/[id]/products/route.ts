import { NextResponse } from "next/server";
import { collectionService } from "@/services/collectionService";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const products = await collectionService.getCollectionProducts(id);
    return NextResponse.json(products);
  } catch (error: any) {
    return NextResponse.json({ message: error.message || "Failed to fetch collection products" }, { status: 500 });
  }
}
