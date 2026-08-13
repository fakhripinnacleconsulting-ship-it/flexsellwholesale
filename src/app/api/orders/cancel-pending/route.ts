import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { requireAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateAdminDashboard, revalidateProductStock } from "@/lib/revalidate";

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

    // Check ownership or manager permissions
    if (payload.role === "manager") {
      const access = await verifyManagerOrderAccess(payload, order);
      if (access.error) return access.error;
    } else if (payload.role !== "admin") {
      const isOwner =
        order.customerId === payload.userId ||
        order.shippingAddress?.email?.toLowerCase() === payload.email.toLowerCase();
      if (!isOwner) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    // Only allow cancelling pending unpaid Razorpay orders
    if (order.paymentStatus === "Paid") {
      return NextResponse.json({ message: "Paid orders cannot be cancelled via this endpoint" }, { status: 400 });
    }

    // Claim the cancellation before restoring stock. Checking the status and writing it
    // after the restore loop let two callers — or one caller racing the abandoned-order
    // reaper — both credit the same stock back. Conditioning the write on the order still
    // being unpaid and uncancelled means exactly one of them proceeds, and an order that
    // completed payment mid-request is left alone.
    const { ORDER_STATUS_CLASSES } = await import("@/lib/constants");

    const claimed = await Order.findOneAndUpdate(
      {
        _id: orderId,
        paymentStatus: { $ne: "Paid" },
        status: { $ne: "Cancelled" },
      } as Record<string, unknown>,
      {
        $set: {
          status: "Cancelled",
          statusClass: ORDER_STATUS_CLASSES.Cancelled,
          paymentStatus: "Failed",
        },
        $push: {
          history: {
            $each: [{
              status: "Cancelled",
              timestamp: new Date().toLocaleString("en-US", {
                month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
              }),
              description: "Order cancelled: Online payment window closed without completing payment. Stock restored.",
            }],
            $position: 0,
          },
        },
      },
      { new: true }
    );

    if (!claimed) {
      return NextResponse.json(
        { message: "This order is already cancelled or has been paid." },
        { status: 400 }
      );
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

    revalidateAdminDashboard();
    revalidateProductStock();

    return NextResponse.json({ success: true, message: "Pending order cancelled and stock restored" });
  } catch (error: any) {
    console.error("Cancel pending order error:", error);
    return NextResponse.json({ message: error.message || "Failed to cancel pending order" }, { status: 500 });
  }
}
