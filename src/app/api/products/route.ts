import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import { generateNextId } from "@/lib/idGeneratorServer";
import { requireAuth } from "@/lib/authGuard";
import { productSchema } from "@/lib/validators";
import { ZodError } from "zod";

import { searchService } from "@/services/searchService";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("search") || searchParams.get("sku");
    const categoryId = searchParams.get("categoryId") || searchParams.get("category");
    const page = searchParams.get("page");
    const limit = searchParams.get("limit");

    if (query || categoryId || (page && limit)) {
      const options = {
        query: query || undefined,
        categoryId: categoryId || undefined,
        minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
        maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
        inStock: searchParams.get("inStock") === "true",
        minDiscount: searchParams.get("minDiscount") ? Number(searchParams.get("minDiscount")) : undefined,
        sortBy: (searchParams.get("sortBy") as any) || undefined,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      };

      const result = await searchService.searchProducts(options);
      
      // If caller expects simple array payload without pagination envelope (no page/limit explicitly provided)
      if (!page && !limit && query) {
        return NextResponse.json(result.products);
      }

      return NextResponse.json(result);
    }

    // Retrieve products sorted by newest first (capped at 500 to prevent OOM at scale)
    const products = await Product.find({}).sort({ createdAt: -1 }).limit(500);
    return NextResponse.json(products);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch products" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const body = await request.json();
    
    const validatedData = productSchema.parse(body);

    // Generate a product ID if not provided
    if (!validatedData._id) {
      validatedData._id = await generateNextId("product");
    }
    
    const newProduct = await Product.create(validatedData);
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to create product" }, { status: 500 });
  }
}
