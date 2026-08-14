import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { requireAuth, requireAdminOrManagerAuth, verifyManagerOrderAccess } from "@/lib/authGuard";
import { actorLabel, buildHistoryEvent, resolveActor } from "@/lib/orderHistory";
import Manager from "@/models/Manager";
import { orderSchema } from "@/lib/validators";
import { ZodError } from "zod";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { revalidateAdminDashboard, revalidateProductStock } from "@/lib/revalidate";

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

    // Same rule as the list endpoint: staff-only history fields never leave the database
    // for a customer, so no component downstream can accidentally render a staff name.
    const isStaffViewer = payload.role === "admin" || payload.role === "manager";
    const order = await Order.findById(id)
      .select(isStaffViewer ? "" : "-history.internalNote -history.actor")
      .lean();
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Verify ownership
    if (payload.role === "manager") {
      let perms = (payload as any).permissions || [];
      if (payload.userId && /^[0-9a-fA-F]{24}$/.test(payload.userId)) {
        const managerUser = await Manager.findById(payload.userId).lean();
        if (managerUser) {
          perms = managerUser.permissions || [];
        }
      }
      const hasPerm = (p: string) => perms.includes(p) || perms.includes(`${p}:read`) || perms.includes(`${p}:update`) || perms.includes(`${p}:create`) || perms.includes(`${p}:delete`);
      
      const orderType = (order as any).orderType;
      let allowed = false;
      if (orderType === "B2C" && hasPerm("orders_b2c")) allowed = true;
      if (orderType === "B2B" && hasPerm("orders_b2b")) allowed = true;
      if (!orderType && hasPerm("orders_b2b")) allowed = true; // Legacy B2B
      if (orderType === "Dropshipping" && hasPerm("orders_dropshipping")) allowed = true;
      
      if (!allowed) {
        return NextResponse.json({ message: "Forbidden: You don't have access to this order." }, { status: 403 });
      }
    } else if (payload.role !== "admin") {
      const isOwner =
        (order as any).customerId === payload.userId ||
        (order as any).shippingAddress?.email?.toLowerCase() === payload.email.toLowerCase();
      if (!isOwner) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json(order);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch order" }, { status: 500 });
  }
}

// PUT: Modify order details (quantities, items, shipping address) - Restricted to Admin
export async function PUT(request: NextRequest, { params }: RouteProps) {
  try {
    const auth = await requireAdminOrManagerAuth();
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const access = await verifyManagerOrderAccess(auth.payload!, order);
    if (access.error) return access.error;

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
      order.customerName = `${shippingAddress.firstName} ${shippingAddress.lastName}${shippingAddress.company ? ` (${shippingAddress.company})` : ""
        }`;
    }
    if (status !== undefined) order.status = status;

    // Log the edit action in history. The internal note names whoever actually made the
    // edit — previously this said "by Administrator" even when a manager did it.
    const editActor = resolveActor(auth.payload!, access.manager?.name);
    order.history.unshift(
      buildHistoryEvent({
        status: order.status,
        actor: editActor,
        customerNote: "Your order details were updated by FlexSell Wholesale.",
        internalNote: `Order items, quantities or shipping address modified by ${actorLabel(editActor)}.`,
      })
    );

    await order.save();
    revalidateAdminDashboard();
    revalidateProductStock();

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
    const auth = await requireAdminOrManagerAuth();
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const order: any = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const access = await verifyManagerOrderAccess(auth.payload!, order);
    if (access.error) return access.error;

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

    // Dispatch Centralized Event (Triggers Email & Notifications)
    try {
      const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
      const customerEmail = order.shippingAddress?.email || "";
      const customerName = order.customerName || order.shippingAddress?.name || "Valued Customer";

      dispatchEventServer({
        eventType: "ORDER_CANCELLED",
        category: "orders",
        actor: { id: auth.payload?.userId || "admin", name: "Admin", role: "admin" },
        recipient: { customerId: order.customerId || "", email: customerEmail, name: customerName, role: "both" },
        entity: { type: "order", id: order._id },
        data: {
          order: order.toObject ? order.toObject() : order,
          status: "Cancelled"
        }
      });
    } catch (err) {
      console.error("Failed to dispatch ORDER_CANCELLED event:", err);
    }

    await Order.findByIdAndDelete(id);
    revalidateAdminDashboard();
    revalidateProductStock();

    return NextResponse.json({ message: "Order cancelled and deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to cancel order" }, { status: 500 });
  }
}
