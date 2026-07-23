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
    const validatedData = couponSchema.partial().parse(body);

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return NextResponse.json({ message: "Coupon not found" }, { status: 404 });
    }

    if (validatedData.code !== undefined) {
      const uppercaseCode = validatedData.code.toUpperCase().trim();
      if (uppercaseCode !== coupon.code) {
        // Verify code is unique
        const existing = await Coupon.findOne({ code: uppercaseCode });
        if (existing) {
          return NextResponse.json({ message: `Coupon with code "${uppercaseCode}" already exists` }, { status: 400 });
        }
        coupon.code = uppercaseCode;
      }
    }

    if (validatedData.discountType !== undefined) coupon.discountType = validatedData.discountType;
    if (validatedData.discountValue !== undefined) coupon.discountValue = validatedData.discountValue;
    if (validatedData.minOrderValue !== undefined) coupon.minOrderValue = validatedData.minOrderValue;
    if (validatedData.maxDiscount !== undefined) coupon.maxDiscount = validatedData.maxDiscount;
    if (validatedData.expiryDate !== undefined) coupon.expiryDate = validatedData.expiryDate;
    if (validatedData.isActive !== undefined) coupon.isActive = validatedData.isActive;
    if (validatedData.isPersonalized !== undefined) coupon.isPersonalized = validatedData.isPersonalized;
    if (validatedData.allowedCustomers !== undefined) coupon.allowedCustomers = validatedData.allowedCustomers.map((e: string) => e.toLowerCase().trim());
    if (validatedData.usageLimit !== undefined) coupon.usageLimit = validatedData.usageLimit;
    if (validatedData.usageLimitPerCustomer !== undefined) coupon.usageLimitPerCustomer = validatedData.usageLimitPerCustomer;

    await coupon.save();

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
