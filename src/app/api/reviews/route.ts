import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Review from "@/models/Review";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import Product from "@/models/Product";
import { requireAuth } from "@/lib/authGuard";
import { reviewSchema } from "@/lib/validators";
import { ZodError } from "zod";

// GET: Fetch approved reviews for a product OR all reviews by the logged-in customer
export async function GET(request: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    // If productId is provided, fetch public approved reviews for the product
    if (productId) {
      const productReviews = await Review.find({ productId, status: "approved" })
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json(productReviews);
    }

    // Otherwise, fetch reviews written by the authenticated active customer
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    const customerReviews = await Review.find({ customerId: payload.userId })
      .sort({ createdAt: -1 })
      .lean();
      
    // Populate product titles
    const populatedReviews = await Promise.all(
      customerReviews.map(async (rev: any) => {
        const prod = await Product.findById(rev.productId).select("title slug").lean();
        return {
          ...rev,
          productTitle: prod ? prod.title : "Unknown Product",
          productSlug: prod ? prod.slug : ""
        };
      })
    );

    return NextResponse.json(populatedReviews);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch reviews" }, { status: 500 });
  }
}

// POST: Submit a new review
export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const body = await request.json();
    
    const validatedData = reviewSchema.parse(body);

    // 1. Get customer details
    const customer = await Customer.findById(payload.userId).lean();
    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    // 2. Check if already reviewed
    const existingReview = await Review.findOne({ productId: validatedData.productId, customerId: customer._id });
    if (existingReview) {
      return NextResponse.json({ message: "You have already reviewed this product." }, { status: 400 });
    }

    // 3. Verify B2B purchase history (Industry level)
    const verifiedOrder = await Order.findOne({
      "shippingAddress.email": customer.email,
      "items.product._id": validatedData.productId,
      status: { $in: ["Shipped", "Delivered"] }
    });

    if (!verifiedOrder) {
      return NextResponse.json({ message: "Only customers who purchased this product can leave a review." }, { status: 403 });
    }

    // 4. Create Review
    const newReview = await Review.create({
      productId: validatedData.productId,
      customerId: customer._id,
      customerName: customer.name,
      rating: validatedData.rating,
      title: validatedData.title,
      comment: validatedData.comment,
      status: "pending" // Admin moderation required by default
    });

    return NextResponse.json(newReview, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ message: error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }
    return NextResponse.json({ message: (error as any).message || "Failed to submit review" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ message: "Review ID is required" }, { status: 400 });
    }

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ message: "Review not found" }, { status: 404 });
    }

    if (review.customerId !== payload.userId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    await Review.findByIdAndDelete(id);

    // Recalculate aggregates
    const allApproved = await Review.find({ productId: review.productId, status: "approved" });
    const totalCount = allApproved.length;
    const avgRating = totalCount > 0 
      ? allApproved.reduce((sum, r) => sum + r.rating, 0) / totalCount 
      : 0;

    await Product.findByIdAndUpdate(review.productId, {
      rating: parseFloat(avgRating.toFixed(1)) || 0,
      reviewCount: totalCount
    });

    return NextResponse.json({ message: "Review deleted successfully" });
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to delete review" }, { status: 500 });
  }
}
