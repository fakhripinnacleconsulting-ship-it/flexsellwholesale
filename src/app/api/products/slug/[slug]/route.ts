import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import { requireAdminOrManagerAuth } from "@/lib/authGuard";

/**
 * Fetches a product by its **id or its slug**.
 *
 * The route path still says `slug` because that is what it was, and renaming it would break
 * every caller for no gain. What changed is the lookup: product URLs are keyed on `_id`
 * (`PROD-0101`) now, so the browser asks for products by id — while previously indexed slugs
 * must still resolve.
 *
 * This mirrors the server-side branch in `productService.fetchProductByIdentifier`. Both
 * needed updating: missing this one left the client re-fetch on the product page throwing
 * "Product not found" against an id the server had just resolved happily.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    await dbConnect();
    const { slug } = await params;

    /**
     * One query, not two: `$or` returns a hit on either field in a single round trip.
     *
     * Filtering the catalogue list alone was not enough — a withdrawn product's own URL still
     * rendered it, and that URL outlives the listing in bookmarks, search engines and shared
     * links. `$ne: false` rather than `=== true` so products written before the field existed
     * stay visible: they were never deactivated, and treating a missing field as "withdrawn"
     * would empty the catalogue.
     */
    const includeInactive = new URL(request.url).searchParams.get("includeInactive") === "true";
    if (includeInactive) {
      const staffAuth = await requireAdminOrManagerAuth();
      if (staffAuth.error) return staffAuth.error;
    }

    const product = await Product.findOne({
      $or: [{ _id: slug }, { slug }],
      ...(includeInactive ? {} : { isActive: { $ne: false } }),
    } as Record<string, unknown>);

    if (!product) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to fetch product" },
      { status: 500 }
    );
  }
}
