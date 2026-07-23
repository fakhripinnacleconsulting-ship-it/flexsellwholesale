import { NextResponse } from "next/server";
import { searchService, SearchOptions } from "@/services/searchService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const options: SearchOptions = {
      query: searchParams.get("q") || searchParams.get("query") || undefined,
      sku: searchParams.get("sku") || undefined,
      categoryId: searchParams.get("categoryId") || searchParams.get("category") || undefined,
      collectionId: searchParams.get("collectionId") || undefined,
      minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
      maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
      inStock: searchParams.get("inStock") === "true",
      minDiscount: searchParams.get("minDiscount") ? Number(searchParams.get("minDiscount")) : undefined,
      sortBy: (searchParams.get("sortBy") as any) || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 12,
    };

    const result = await searchService.searchProducts(options);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Search failed" },
      { status: 500 }
    );
  }
}
