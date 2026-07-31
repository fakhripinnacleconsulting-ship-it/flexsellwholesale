import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/authGuard";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { ORDER_STATUS_CLASSES } from "@/lib/constants";
import { revalidateAdminDashboard, revalidateProducts } from "@/lib/revalidate";

interface RouteProps {
  params: Promise<{ id: string }>;
}

// Statuses a customer may still back out of — once shipping has started, only admin can intervene.
const CUSTOMER_CANCELLABLE_STATUSES = ["Placed", "Pending", "Confirmed"];

// PUT: Customer (or admin) cancels a pre-shipment order — soft-cancels and restores stock,
// unlike the admin DELETE endpoint which permanently removes the order record.
export async function PUT(request: NextRequest, { params }: RouteProps) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const { id } = await params;

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    if (payload.role !== "admin" && order.shippingAddress?.email?.toLowerCase() !== payload.email.toLowerCase()) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    if (order.status === "Cancelled") {
      return NextResponse.json({ message: "This order is already cancelled." }, { status: 400 });
    }

    if (!CUSTOMER_CANCELLABLE_STATUSES.includes(order.status)) {
      return NextResponse.json(
        { message: "This order has already entered fulfillment and can no longer be cancelled here. Please contact support." },
        { status: 400 }
      );
    }

    // Restore stock for every item, same atomic pattern used by the admin cancel/delete flow.
    for (const oldItem of order.items) {
      try {
        const dbProduct = await Product.findById(oldItem.product._id);
        if (!dbProduct) continue;

        const { color, size, weight } = resolveVariantKeys(oldItem.selectedVariants);

        const cv = dbProduct.colorVariants?.find((c: any) => c.color.toLowerCase() === color.toLowerCase());
        if (!cv) continue;

        const sv = cv.subVariants?.find((s: any) =>
          (!size || s.size.toLowerCase() === size.toLowerCase()) &&
          (!weight || s.weight.toLowerCase() === weight.toLowerCase())
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
        console.error("Failed to restore stock during customer order cancellation:", oldItem, err);
      }
    }

    order.status = "Cancelled";
    order.statusClass = ORDER_STATUS_CLASSES.Cancelled;
    order.history.unshift({
      status: "Cancelled",
      timestamp: new Date().toLocaleString("en-US", {
        month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
      description: payload.role === "admin" ? "Order cancelled by administrator." : "Order cancelled by customer."
    });

    await order.save();
    revalidateAdminDashboard();
    revalidateProducts();

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to cancel order" }, { status: 500 });
  }
}
