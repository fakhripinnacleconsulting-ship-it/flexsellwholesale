import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Coupon from "@/models/Coupon";
import { requireAuth } from "@/lib/authGuard";
import { couponSchema } from "@/lib/validators";
import { ZodError } from "zod";

interface RouteProps {
  params: Promise<{ id: string }>;
}

// PUT: Update coupon parameters (restricted to admins)
export async function PUT(request: Request, { params }: RouteProps) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const body = await request.json();
    
    // Parse partial coupon schema
    const parsedData = couponSchema.partial().parse(body);

    const updateData: any = {};
    for (const key of Object.keys(body)) {
      if (key in parsedData) {
        updateData[key] = (parsedData as any)[key];
      }
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json({ message: "Coupon not found" }, { status: 404 });
    }

    if (updateData.code !== undefined) {
      const uppercaseCode = updateData.code.toUpperCase().trim();
      if (uppercaseCode !== coupon.code) {
        // Verify code is unique
        const existing = await Coupon.findOne({ code: uppercaseCode });
        if (existing) {
          return NextResponse.json({ message: `Coupon with code "${uppercaseCode}" already exists` }, { status: 400 });
        }
        coupon.code = uppercaseCode;
      }
    }

    if (updateData.discountType !== undefined) coupon.discountType = updateData.discountType;
    if (updateData.discountValue !== undefined) coupon.discountValue = updateData.discountValue;
    if (updateData.minOrderValue !== undefined) coupon.minOrderValue = updateData.minOrderValue;
    if (updateData.maxDiscount !== undefined) coupon.maxDiscount = updateData.maxDiscount;
    if (updateData.expiryDate !== undefined) coupon.expiryDate = updateData.expiryDate;
    if (updateData.isActive !== undefined) coupon.isActive = updateData.isActive;
    if (updateData.isPersonalized !== undefined) coupon.isPersonalized = updateData.isPersonalized;
    if (updateData.allowedCustomers !== undefined) coupon.allowedCustomers = updateData.allowedCustomers.map((e: string) => e.toLowerCase().trim());
    if (updateData.usageLimit !== undefined) coupon.usageLimit = updateData.usageLimit;
    if (updateData.usageLimitPerCustomer !== undefined) coupon.usageLimitPerCustomer = updateData.usageLimitPerCustomer;

    await coupon.save();

    if (coupon.isActive) {
      try {
        const { dispatchEvent } = await import("@/lib/events/eventDispatcher");
        const CustomerModel = (await import("@/models/Customer")).default;
        const couponObj = coupon.toObject ? coupon.toObject() : coupon;

        if (coupon.isPersonalized && coupon.allowedCustomers?.length > 0) {
          const targetEmails = coupon.allowedCustomers.map((e: string) => e.toLowerCase().trim());
          const targetCustomers = await CustomerModel.find({ email: { $in: targetEmails } }).select("_id email name");

          for (const email of targetEmails) {
            const cust = targetCustomers.find((c: any) => c.email.toLowerCase() === email);
            dispatchEvent({
              eventType: "COUPON_LIVE",
              category: "system",
              actor: { id: "admin", name: "System Admin", role: "admin" },
              recipient: { customerId: cust?._id || "all", email, name: cust?.name || "Valued Buyer", role: "customer" },
              entity: { type: "coupon", id: coupon._id.toString() },
              data: couponObj
            });
          }
        } else {
          // Public Coupon: Dispatch to all registered buyers + global broadcast
          const allCustomers = await CustomerModel.find({ role: "customer" }).select("_id email name");

          for (const cust of allCustomers) {
            dispatchEvent({
              eventType: "COUPON_LIVE",
              category: "system",
              actor: { id: "admin", name: "System Admin", role: "admin" },
              recipient: { customerId: cust._id.toString(), email: cust.email, name: cust.name, role: "customer" },
              entity: { type: "coupon", id: coupon._id.toString() },
              data: couponObj
            });
          }

          // Global broadcast for in-app notification queries matching customerId: "all"
          dispatchEvent({
            eventType: "COUPON_LIVE",
            category: "system",
            actor: { id: "admin", name: "System Admin", role: "admin" },
            recipient: { customerId: "all", role: "customer" },
            entity: { type: "coupon", id: coupon._id.toString() },
            data: couponObj
          });
        }
      } catch (err) {
        console.error("Failed to dispatch COUPON_LIVE event on update:", err);
      }
    }

    return NextResponse.json(coupon);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to update coupon" }, { status: 500 });
  }
}

// DELETE: Delete a coupon permanently (restricted to admins)
export async function DELETE(request: Request, { params }: RouteProps) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json({ message: "Coupon not found" }, { status: 404 });
    }

    await Coupon.findByIdAndDelete(id);

    return NextResponse.json({ message: "Coupon deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete coupon" }, { status: 500 });
  }
}
