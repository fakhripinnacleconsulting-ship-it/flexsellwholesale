import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";

/**
 * Live stock lookup for cached product pages.
 *
 * Product HTML is cached with a long revalidate window, so the stock numbers baked into
 * it can be up to a day old. Rather than rebuilding that HTML on every order (which was
 * the largest single source of ISR writes), pages render the cached figure for first
 * paint and then correct it from here on the client.
 *
 * Deliberately tiny: ids in, stock out. No pricing, no descriptions, no images.
 */

export const dynamic = "force-dynamic";

/** Bounds the query so a crafted URL cannot ask for the whole catalog. */
const MAX_IDS = 50;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids") || "";

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS);

    if (ids.length === 0) {
      return NextResponse.json({ stock: [] });
    }

    await dbConnect();

    const products = await Product.find({ _id: { $in: ids } })
      .select("_id totalStock isActive colorVariants.color colorVariants.subVariants.id colorVariants.subVariants.sku colorVariants.subVariants.stock colorVariants.subVariants.isActive")
      .lean<Array<{
        _id: string;
        totalStock?: number;
        isActive?: boolean;
        colorVariants?: Array<{
          color?: string;
          subVariants?: Array<{ id?: string; sku?: string; stock?: number; isActive?: boolean }>;
        }>;
      }>>();

    const stock = products.map((p) => ({
      _id: p._id,
      totalStock: p.totalStock ?? 0,
      isActive: p.isActive !== false,
      variants: (p.colorVariants || []).flatMap((cv) =>
        (cv.subVariants || []).map((sv) => ({
          id: sv.id,
          sku: sv.sku,
          stock: sv.stock ?? 0,
          isActive: sv.isActive !== false,
        }))
      ),
    }));

    return NextResponse.json(
      { stock },
      // Never cached: the whole point of this route is that it is the fresh source.
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to fetch stock" },
      { status: 500 }
    );
  }
}
