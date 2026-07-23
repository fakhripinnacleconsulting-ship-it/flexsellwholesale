import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Category from "@/models/Category";
import Order from "@/models/Order";

export async function GET() {
  try {
    await dbConnect();

    // 1. Get all active categories
    const categories = await Category.find({ isActive: true }).select("_id").lean();
    const categoryIds = categories.map(c => c._id);

    // 2. Get all active products
    const products = await Product.find({ isActive: true }).lean();

    // 3. Get all non-cancelled orders
    const orders = await Order.find({ status: { $ne: "Cancelled" } }).select("items").lean();

    // 4. Calculate total quantity sold for each product
    const salesMap: Record<string, number> = {};
    for (const order of orders) {
      if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) {
          const productId = item.productId || item.product?._id || (typeof item.product === "string" ? item.product : undefined);
          if (productId) {
            salesMap[productId] = (salesMap[productId] || 0) + (Number(item.quantity) || 0);
          }
        }
      }
    }

    // 5. Group products by categoryId
    const categoryProducts: Record<string, typeof products> = {};
    for (const product of products) {
      const catId = product.categoryId;
      if (!categoryProducts[catId]) {
        categoryProducts[catId] = [];
      }
      categoryProducts[catId].push(product);
    }

    // 6. Collect top product from each category, and gather products with sales
    const trendingProducts: typeof products = [];
    const addedProductIds = new Set<string>();

    for (const catId of categoryIds) {
      const catProds = categoryProducts[catId] || [];
      if (catProds.length === 0) continue;

      // Sort products of this category by sales count descending, then by createdAt descending
      catProds.sort((a, b) => {
        const salesA = salesMap[a._id] || 0;
        const salesB = salesMap[b._id] || 0;
        if (salesA !== salesB) {
          return salesB - salesA;
        }
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      // Top product from this category is guaranteed to be in trending list
      const topProduct = catProds[0];
      if (topProduct) {
        trendingProducts.push(topProduct);
        addedProductIds.add(topProduct._id);
      }
    }

    // Add any other products that have sales > 0
    for (const product of products) {
      if (!addedProductIds.has(product._id)) {
        const sales = salesMap[product._id] || 0;
        if (sales > 0) {
          trendingProducts.push(product);
          addedProductIds.add(product._id);
        }
      }
    }

    // Sort all gathered trending products by sales count descending, then by createdAt descending
    trendingProducts.sort((a, b) => {
      const salesA = salesMap[a._id] || 0;
      const salesB = salesMap[b._id] || 0;
      if (salesA !== salesB) {
        return salesB - salesA;
      }
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json(trendingProducts);
  } catch (error: unknown) {
    return NextResponse.json(
      { message: (error as any).message || "Failed to fetch trending products" },
      { status: 500 }
    );
  }
}
