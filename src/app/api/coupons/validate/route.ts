import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Coupon from "@/models/Coupon";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { code, orderValue, orderAmount } = body;
    const valueInput = orderValue !== undefined ? orderValue : orderAmount;

    if (!code || valueInput === undefined) {
      return NextResponse.json({ message: "Code and orderValue/orderAmount are required" }, { status: 400 });
    }

    const uppercaseCode = code.toUpperCase().trim();
    const coupon = await Coupon.findOne({ code: uppercaseCode });

    if (!coupon) {
      return NextResponse.json({ message: `Invalid coupon code "${uppercaseCode}"` }, { status: 400 });
    }

    if (!coupon.isActive) {
      return NextResponse.json({ message: "This coupon is no longer active" }, { status: 400 });
    }

    // Check user authentication details
    const token = await getTokenFromCookie();
    let userEmail = "";
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        userEmail = payload.email?.toLowerCase() || "";
      }
    }

    // 1. Overall Usage Limit check
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
      if ((coupon.usedCount || 0) >= coupon.usageLimit) {
        return NextResponse.json({ message: "This coupon is fully redeemed and no longer available" }, { status: 400 });
      }
    }

    // 2. Personalization check
    if (coupon.isPersonalized) {
      if (!userEmail) {
        return NextResponse.json({ message: "This coupon is personalized and requires you to log in" }, { status: 400 });
      }
      const isAllowed = coupon.allowedCustomers?.some((email: string) => email.toLowerCase() === userEmail);
      if (!isAllowed) {
        return NextResponse.json({ message: "This coupon is not valid for your account" }, { status: 400 });
      }
    }

    // 3. Per-customer Usage Limit check
    if (userEmail) {
      const customerUses = coupon.usedBy?.filter((email: string) => email.toLowerCase() === userEmail).length || 0;
      const customerLimit = coupon.usageLimitPerCustomer || 1;
      if (customerUses >= customerLimit) {
        return NextResponse.json({ message: "You have already reached the maximum usage limit for this coupon" }, { status: 400 });
      }
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (coupon.expiryDate < todayStr) {
      return NextResponse.json({ message: "This coupon has expired" }, { status: 400 });
    }

    const value = parseFloat(valueInput);
    if (value < coupon.minOrderValue) {
      return NextResponse.json({
        message: `Minimum purchase amount of ₹${coupon.minOrderValue} is required to use this coupon.`
      }, { status: 400 });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.discountType === "flat") {
      discountAmount = coupon.discountValue;
    } else {
      // Percentage discount
      discountAmount = value * (coupon.discountValue / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
        discountAmount = coupon.maxDiscount;
      }
    }

    // Ensure discount does not exceed order value
    if (discountAmount > value) {
      discountAmount = value;
    }

    const roundedDiscount = parseFloat(discountAmount.toFixed(2));
    const finalAmount = parseFloat((value - roundedDiscount).toFixed(2));

    return NextResponse.json({
      valid: true,
      success: true,
      discountAmount: roundedDiscount,
      finalAmount,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },
      couponCode: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to validate coupon" }, { status: 500 });
  }
}
