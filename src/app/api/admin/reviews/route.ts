import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Review from "@/models/Review";
import Product from "@/models/Product";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

// GET: Retrieve all reviews for moderation
export async function GET() {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const reviews = await Review.find().sort({ createdAt: -1 }).lean();

    // Populate product titles
    const populated = await Promise.all(
      reviews.map(async (rev: any) => {
        const prod = await Product.findById(rev.productId).select("title slug").lean();
        return {
          ...rev,
          productTitle: prod ? prod.title : "Deleted Product",
          productSlug: prod ? prod.slug : ""
        };
      })
    );

    return NextResponse.json(populated);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to fetch reviews" }, { status: 500 });
  }
}

// PUT: Approve/Reject review or submit Admin Response
export async function PUT(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { _id, status, adminResponse } = body;

    if (!_id) {
      return NextResponse.json({ message: "Review ID is required" }, { status: 400 });
    }

    const review = await Review.findById(_id);
    if (!review) {
      return NextResponse.json({ message: "Review not found" }, { status: 404 });
    }

    const oldStatus = review.status;

    if (status !== undefined) review.status = status;
    if (adminResponse !== undefined) review.adminResponse = adminResponse;

    await review.save();

    // If status changed to or from approved, recalculate product rating aggregates
    if (status !== undefined && oldStatus !== status) {
      const allApproved = await Review.find({ productId: review.productId, status: "approved" });
      const totalCount = allApproved.length;
      const avgRating = totalCount > 0 
        ? allApproved.reduce((sum, r) => sum + r.rating, 0) / totalCount 
        : 0;

      await Product.findByIdAndUpdate(review.productId, {
        rating: parseFloat(avgRating.toFixed(1)) || 0,
        reviewCount: totalCount
      });
    }

    return NextResponse.json(review);
  } catch (error: unknown) {
    return NextResponse.json({ message: (error as any).message || "Failed to update review" }, { status: 500 });
  }
}

// DELETE: Delete a review permanently
export async function DELETE(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ message: "Review ID is required" }, { status: 400 });
    }

    const review = await Review.findById(id);
    if (!review) {
      return NextResponse.json({ message: "Review not found" }, { status: 404 });
    }

    await Review.findByIdAndDelete(id);

    // Recalculate product rating aggregates
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
