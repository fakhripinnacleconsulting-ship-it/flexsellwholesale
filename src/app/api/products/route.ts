import { NextResponse, after } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import { generateNextId } from "@/lib/idGeneratorServer";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";
import { productSchema } from "@/lib/validators";
import { ZodError } from "zod";

import { searchService } from "@/services/searchService";
import { PRODUCT_LIST_EXCLUDED_FIELDS } from "@/lib/productProjection";

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
    //
    // `.lean()` is the important part: without it Mongoose hydrates up to 2000 full
    // documents (each with nested colorVariants/subVariants subdocument schemas), which
    // was the single largest CPU consumer in the application. Admin screens that need
    // the untouched document opt in with ?view=full.
    const isListView = searchParams.get("view") === "list";

    /**
     * Withdrawn products are invisible to the public, and visible to staff who ask.
     *
     * This query was `Product.find({})`, so deactivating a product removed it from precisely
     * nowhere — it stayed on the catalogue and on its own page. The inconsistency was already
     * half-present: `searchService` filters `isActive: true`, so a withdrawn product vanished
     * from search while remaining browsable.
     *
     * The filter is the **default** rather than something each consumer applies, because a
     * component that forgets to filter leaks the product; an absent row cannot.
     *
     * `includeInactive` exists because deactivating means *withdraw from sale*, not *delete*:
     * staff still put these on an order, invoice or quote for a back-order or a price already
     * agreed. It requires a staff session — a request without one is refused rather than
     * quietly downgraded, so a stale client fails loudly instead of appearing to work.
     */
    const wantsInactive = searchParams.get("includeInactive") === "true";
    if (wantsInactive) {
      const staffAuth = await requireAdminOrManagerAuth();
      if (staffAuth.error) return staffAuth.error;
    }

    const catalogFilter = wantsInactive ? {} : { isActive: { $ne: false } };

    const catalogQuery = Product.find(catalogFilter).sort({ createdAt: -1 }).limit(UNFILTERED_CATALOG_CAP);
    if (isListView) {
      catalogQuery.select(PRODUCT_LIST_EXCLUDED_FIELDS);
    }

    const products = await catalogQuery.lean();
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

    // Pass the id. Without it the `revalidatePath("/products/<id>")` inside
    // revalidateProducts is dead code, and the product's own page keeps serving whatever the
    // cache holds until its 24h window expires — which is why an edited product took a day to
    // change while its card on the listing updated at once.
    await revalidateProducts(String(newProduct._id));

    /**
     * Build the new product's page now, so the first customer to open it does not have to.
     *
     * Purging a path does not generate it — it only guarantees the next visitor gets a cache
     * MISS, and that visitor is the one currently paying a ~5s cold render (and, in
     * production, seeing a 500 when it overruns).
     *
     * `after()` rather than a bare `fetch(...).catch()`: a promise left pending when the
     * response is sent is cancelled on Vercel, so fire-and-forget never actually connects.
     * `after` is the primitive for work that must outlive the response.
     */
    after(async () => {
      const base =
        process.env.NEXT_PUBLIC_SITE_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      if (!base) return;

      await fetch(`${base}/products/${newProduct._id}`, { cache: "no-store" }).catch((err) =>
        // Swallowed on purpose: the admin's save must never fail because a warm-up did.
        console.warn("[products] page warm-up failed:", (err as Error)?.message)
      );
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to create product" }, { status: 500 });
  }
}

