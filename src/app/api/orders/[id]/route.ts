import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/authGuard";
import { orderSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { resolveVariantKeys } from "@/lib/variantMatcher";

interface RouteProps {
  params: Promise<{ id: string }>;
}

// GET: Retrieve a specific order by ID
export async function GET(request: NextRequest, { params }: RouteProps) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const order = await Order.findById(id).lean();
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (payload.role !== "admin" && (order as any).shippingAddress?.email?.toLowerCase() !== payload.email.toLowerCase()) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch order" }, { status: 500 });
  }
}

// PUT: Modify order details (quantities, items, shipping address) - Restricted to Admin
export async function PUT(request: NextRequest, { params }: RouteProps) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = orderSchema.partial().parse(body);
    const { items, amount, shippingAddress, status } = validatedData;

    // Save previous stock changes if items are modified
    if (items) {
      // 1. Restore previous stock first
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

          // Atomic restore
          await Product.updateOne(
            {
              _id: oldItem.product._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": {
                $elemMatch: {
                  size: sv.size,
                  weight: sv.weight
                }
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
          console.error("Failed to restore stock during order edit:", oldItem, err);
        }
      }

      // 2. Deduct new stock
      for (const newItem of items) {
        try {
          const dbProduct = await Product.findById(newItem.product._id);
          if (!dbProduct) continue;

          const { color, size, weight } = resolveVariantKeys(newItem.selectedVariants);

          const cv = dbProduct.colorVariants?.find((c: any) => c.color.toLowerCase() === color.toLowerCase());
          if (!cv) continue;

          const sv = cv.subVariants?.find((s: any) => 
            (!size || s.size.toLowerCase() === size.toLowerCase()) && 
            (!weight || s.weight.toLowerCase() === weight.toLowerCase())
          );
          if (!sv) continue;

          // Atomic deduct
          await Product.updateOne(
            {
              _id: newItem.product._id,
              "colorVariants.color": cv.color,
              "colorVariants.subVariants": {
                $elemMatch: {
                  size: sv.size,
                  weight: sv.weight,
                  stock: { $gte: newItem.quantity }
                }
              }
            },
            {
              $inc: {
                "colorVariants.$[cv].subVariants.$[sv].stock": -newItem.quantity,
                totalStock: -newItem.quantity
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
          console.error("Failed to deduct stock during order edit:", newItem, err);
        }
      }

      order.items = items as any;
      order.itemsCount = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
    }

    if (amount !== undefined) order.amount = amount;
    if (shippingAddress) {
      order.shippingAddress = shippingAddress as any;
      order.customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}${
        shippingAddress.company ? ` (${shippingAddress.company})` : ""
      }`;
    }
    if (status !== undefined) order.status = status;

    // Log the edit action in history
    order.history.unshift({
      status: order.status,
      timestamp: new Date().toLocaleString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      description: "Order items, quantities or shipping address modified by Administrator."
    });

    await order.save();

    return NextResponse.json(order);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to update order" }, { status: 500 });
  }
}

// DELETE: Cancel or Delete order permanently
export async function DELETE(request: NextRequest, { params }: RouteProps) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Restore all items stock upon cancellation/deletion atomically
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

        // Atomic restore
        await Product.updateOne(
          {
            _id: oldItem.product._id,
            "colorVariants.color": cv.color,
            "colorVariants.subVariants": {
              $elemMatch: {
                size: sv.size,
                weight: sv.weight
              }
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
        console.error("Failed to restore stock during order deletion:", oldItem, err);
      }
    }

    await Order.findByIdAndDelete(id);

    return NextResponse.json({ message: "Order cancelled and deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to cancel order" }, { status: 500 });
  }
}
