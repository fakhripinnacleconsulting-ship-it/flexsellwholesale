import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Category from "@/models/Category";
import HsnRecord from "@/models/HsnRecord";
import { requireAuth } from "@/lib/authGuard";
import { parseAndValidateExcel } from "@/lib/excelHelper";

export async function POST(request: Request) {
  try {
    // 1. Guard route with admin credentials
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();

    // 2. Parse file from FormData
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ message: "No file uploaded" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    // 3. Fetch system reference details
    const [categories, hsns, systemProducts] = await Promise.all([
      Category.find({}).lean(),
      HsnRecord.find({}).lean(),
      Product.find({}).lean()
    ]);

    // 4. Parse and validate Excel sheet
    const result = await parseAndValidateExcel(
      buffer,
      categories as any,
      hsns as any,
      systemProducts as any
    );

    return NextResponse.json({
      message: "File parsed successfully",
      products: result.products,
      errors: result.errors,
      stats: result.stats
    });
  } catch (error: unknown) {
    console.error("Products Excel Import Error:", error);
    return NextResponse.json(
      { message: (error as any).message || "Failed to process imported Excel file" },
      { status: 500 }
    );
  }
}
