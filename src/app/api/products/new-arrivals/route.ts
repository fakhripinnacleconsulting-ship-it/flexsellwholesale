import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";

export async function GET() {
  try {
    await dbConnect();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const newArrivals = await Product.find({
      isActive: true,
      createdAt: { $gte: cutoffDate }
    }).sort({ createdAt: -1 }).lean();

    return NextResponse.json(newArrivals);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to fetch new arrivals" },
      { status: 500 }
    );
  }
}
