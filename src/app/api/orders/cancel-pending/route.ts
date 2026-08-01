import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/authGuard";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateAdminDashboard, revalidateProducts } from "@/lib/revalidate";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    const { orderId } = await request.json();
    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    await dbConnect();
    const order: any = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Check ownership
    const isOwner =
      order.customerId === payload.userId ||
      order.shippingAddress?.email?.toLowerCase() === payload.email.toLowerCase();
    if (payload.role !== "admin" && !isOwner) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Only allow cancelling pending unpaid Razorpay orders
    if (order.paymentStatus === "Paid") {
      return NextResponse.json({ message: "Paid orders cannot be cancelled via this endpoint" }, { status: 400 });
    }

    // Restore stock for all items
    for (const oldItem of order.items || []) {
      try {
        const dbProduct = await Product.findById(oldItem.product?._id);
        if (!dbProduct) continue;

        const { color, size, weight } = resolveVariantKeys(oldItem.selectedVariants);
        const cv = dbProduct.colorVariants?.find((c: any) => c.color?.toLowerCase() === color.toLowerCase());
        if (!cv) continue;

        const sv = cv.subVariants?.find((s: any) =>
          (!size || s.size?.toLowerCase() === size.toLowerCase()) &&
          (!weight || s.weight?.toLowerCase() === weight.toLowerCase())
        );
        if (!sv) continue;

        await Product.updateOne(
          {
            _id: oldItem.product._id,
            "colorVariants.color": cv.color,
            "colorVariants.subVariants": {
              $elemMatch: { size: sv.size, weight: sv.weight }
            }
          },
          {
            $inc: {
              "colorVariants.$[cv].subVariants.$[sv].stock": oldItem.quantity,
              totalStock: oldItem.quantity
            }
          },
          {
            arrayFilters: [
              { "cv.color": cv.color },
              { "sv.size": sv.size, "sv.weight": sv.weight }
            ]
          }
        );
      } catch (err) {
        console.error("Failed to restore stock on pending order cancel:", err);
      }
    }

    // Mark order as Cancelled and Failed payment so it exists in DB as valid cancelled record
    const { ORDER_STATUS_CLASSES } = await import("@/lib/constants");
    order.status = "Cancelled";
    order.statusClass = ORDER_STATUS_CLASSES.Cancelled;
    order.paymentStatus = "Failed";
    order.history = order.history || [];
    order.history.unshift({
      status: "Cancelled",
      timestamp: new Date().toLocaleString("en-US", {
        month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      }),
      description: "Order cancelled: Online payment window closed without completing payment. Stock restored.",
    });

    await order.save();

    revalidateAdminDashboard();
    revalidateProducts();

    return NextResponse.json({ success: true, message: "Pending order cancelled and stock restored" });
  } catch (error: any) {
    console.error("Cancel pending order error:", error);
    return NextResponse.json({ message: error.message || "Failed to cancel pending order" }, { status: 500 });
  }
}
