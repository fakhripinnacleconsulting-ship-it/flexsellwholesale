import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import { generateNextId } from "@/lib/idGeneratorServer";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
import { productSchema } from "@/lib/validators";
import { ZodError } from "zod";

import { searchService } from "@/services/searchService";

/** Upper bound for the unfiltered catalog fetch — guards against OOM at scale. */
const UNFILTERED_CATALOG_CAP = 2000;

export const dynamic = 'force-dynamic';

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

    // Unfiltered catalog fetch. Storefront listing pages load this once to power
    // client-side filtering and infinite scroll, so the cap has to comfortably exceed
    // the catalog size — past this point the tail is silently unreachable. Use the
    // paginated branch above (?page=&limit=) for anything that must scale further.
    const products = await Product.find({})
      .sort({ createdAt: -1 })
      .limit(UNFILTERED_CATALOG_CAP);
    return NextResponse.json(products);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch products" }, { status: 500 });
  }
}

import { revalidateProducts } from "@/lib/revalidate";

export async function POST(request: Request) {
  try {
    const auth = await requireAdminOrManagerAuth("catalog_products:create");
    if (auth.error) return auth.error;

    await dbConnect();
    const body = await request.json();
    
    const validatedData = productSchema.parse(body);

    // Generate a product ID if not provided
    if (!validatedData._id) {
      validatedData._id = await generateNextId("product");
    }

    // Check duplicate slug
    const existingSlug = await Product.findOne({ slug: validatedData.slug }).lean();
    if (existingSlug) {
      return NextResponse.json({ message: `Product slug "${validatedData.slug}" is already taken. Please choose a different title or slug.` }, { status: 400 });
    }

    // Check duplicate SKUs
    const skus: string[] = [];
    validatedData.colorVariants?.forEach((cv: any) => {
      cv.subVariants?.forEach((sv: any) => {
        if (sv.sku) skus.push(sv.sku.trim());
      });
    });
    if (skus.length > 0) {
      const existingSkuDoc = await Product.findOne({ "colorVariants.subVariants.sku": { $in: skus } }).lean();
      if (existingSkuDoc) {
        return NextResponse.json({ message: `SKU collision: One of the SKUs is already assigned to product "${(existingSkuDoc as any).title}".` }, { status: 400 });
      }
    }
    
    const newProduct = await Product.create(validatedData);
    revalidateProducts();
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to create product" }, { status: 500 });
  }
}

