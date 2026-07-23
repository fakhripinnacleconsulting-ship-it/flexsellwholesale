import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import CmsContent from "@/models/CmsContent";
import { requireAuth } from "@/lib/authGuard";

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const body = await request.json();
    const { defaultPriceTier } = body;

    if (!defaultPriceTier || !["B2C", "B2B", "Dropshipping"].includes(defaultPriceTier)) {
      return NextResponse.json({ message: "Invalid price tier selection" }, { status: 400 });
    }

    // 1. Update CMS content setting
    await CmsContent.findOneAndUpdate(
      { key: "globalHighlightPrice" },
      { value: defaultPriceTier },
      { upsert: true, new: true }
    );

    // 2. Update all products in the database
    const result = await Product.updateMany({}, { $set: { defaultPriceTier } });

    return NextResponse.json({
      message: `Successfully set global highlight price to ${defaultPriceTier} and updated ${result.modifiedCount} products.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update global highlight price" }, { status: 500 });
  }
}
