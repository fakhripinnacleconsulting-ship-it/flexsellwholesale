import { NextResponse } from "next/server";
import { searchService } from "@/services/searchService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || searchParams.get("query") || "";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 6;

    if (!query.trim()) {
      return NextResponse.json({ products: [], skus: [], categories: [] });
    }

    const suggestions = await searchService.suggest(query, limit);
    return NextResponse.json(suggestions);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Suggest failed" },
      { status: 500 }
    );
  }
}
