import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { revalidateProducts } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Cancels online orders that were never paid, and returns their stock.
 *
 * This is the counterweight to the "order first" checkout flow: the order (and its stock
 * reservation) is created before the buyer reaches Razorpay, so a buyer who abandons the
 * payment page would otherwise hold that stock forever.
 *
 * Intended to run on a schedule (Vercel Cron). Protected by CRON_SECRET rather than a
 * user session, since no user is present when it runs.
 */
const ABANDON_AFTER_MINUTES = 30;

async function sweepAbandonedOrders(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ message: "CRON_SECRET is not configured" }, { status: 500 });
    }

    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
    const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const cutoff = new Date(Date.now() - ABANDON_AFTER_MINUTES * 60 * 1000);

    // Only online prepaid orders. COD is legitimately unpaid at this stage, and anything
    // already shipped or cancelled must not be touched.
    // Filter is untyped because the Order model declares `createdAt` as a string while
    // Mongoose stores a real Date via `timestamps: true`.
    const staleFilter: Record<string, unknown> = {
      paymentMethod: "Razorpay",
      paymentStatus: "Pending",
      status: { $nin: ["Cancelled", "Shipped", "In Transit", "Delivered"] },
      createdAt: { $lt: cutoff },
    };

    const stale = await Order.find(staleFilter);

    let cancelled = 0;

    for (const order of stale) {
      for (const item of (order as any).items || []) {
        try {
          const dbProduct = await Product.findById(item.product?._id);
          if (!dbProduct) continue;

          const { color, size, weight } = resolveVariantKeys(item.selectedVariants);
          const cv = dbProduct.colorVariants?.find(
            (c: { color?: string }) => c.color?.toLowerCase() === color.toLowerCase()
          );
          if (!cv) continue;

          const sv = cv.subVariants?.find(
            (s: { size?: string; weight?: string }) =>
              (!size || s.size?.toLowerCase() === size.toLowerCase()) &&
              (!weight || s.weight?.toLowerCase() === weight.toLowerCase())
          );
          if (!sv) continue;

          await Product.updateOne(
            {
              _id: item.product._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": { $elemMatch: { size: sv.size, weight: sv.weight } },
            },
            {
              $inc: {
                "colorVariants.$[cv].subVariants.$[sv].stock": item.quantity,
                totalStock: item.quantity,
              },
            },
            {
              arrayFilters: [
                { "cv.color": cv.color },
                { "sv.size": sv.size, "sv.weight": sv.weight },
              ],
            }
          );
        } catch (err) {
          console.error(`[Reaper] Failed to restore stock for order ${order._id}:`, err);
        }
      }

      (order as any).status = "Cancelled";
      (order as any).statusClass = ORDER_STATUS_CLASSES.Cancelled;
      (order as any).history.unshift({
        status: "Cancelled",
        timestamp: new Date().toLocaleString("en-US", {
          month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        description: `Auto-cancelled: online payment not completed within ${ABANDON_AFTER_MINUTES} minutes. Stock returned.`,
      });
      await order.save();
      cancelled++;
    }

    if (cancelled > 0) revalidateProducts();

    return NextResponse.json({ message: "Abandoned order sweep complete", scanned: stale.length, cancelled });
  } catch (error: unknown) {
    console.error("[Reaper] Sweep failed:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Sweep failed" },
      { status: 500 }
    );
  }
}

// Vercel Cron invokes the path with GET; POST is kept for manual runs.
export const GET = sweepAbandonedOrders;
export const POST = sweepAbandonedOrders;
