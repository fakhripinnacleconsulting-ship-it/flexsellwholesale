import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Category from "@/models/Category";
import HsnRecord from "@/models/HsnRecord";
import { requireAuth } from "@/lib/authGuard";
import { exportToExcel } from "@/lib/excelHelper";

export async function GET(request: Request) {
  try {
    // 1. Guard route with admin credentials
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const onlyTemplate = searchParams.get("template") === "true";
    const idsParam = searchParams.get("ids");

    // 3. Fetch reference details
    const [categories, hsns] = await Promise.all([
      Category.find({}).lean(),
      HsnRecord.find({}).lean()
    ]);

    // 4. Retrieve requested products
    let productsList: any[] = [];
    if (!onlyTemplate) {
      if (idsParam) {
        const ids = idsParam.split(",").filter(Boolean);
        productsList = await Product.find({ _id: { $in: ids } }).lean();
      } else {
        productsList = await Product.find({}).lean();
      }
    }

    // 5. Generate Workbook Buffer
    const blob = await exportToExcel(
      productsList as any,
      categories as any,
      hsns as any,
      onlyTemplate
    );
    const arrayBuffer = await blob.arrayBuffer();

    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const filename = onlyTemplate
      ? `flexsell_add_products_${timestamp}.xlsx`
      : `flexsell_update_products_${timestamp}.xlsx`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error: unknown) {
    console.error("Products Excel Export Error:", error);
    return NextResponse.json(
      { message: (error as any).message || "Failed to export products to Excel" },
      { status: 500 }
    );
  }
}
