import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authGuard";
import dbConnect from "@/lib/dbConnect";
import Product from "@/models/Product";
import Order from "@/models/Order";
import Customer from "@/models/Customer";
import { resolvePrice } from "@/lib/priceTierHelper";

export async function GET(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (auth.error) return auth.error;

    await dbConnect();
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const type = searchParams.get("type") || "all";

    if (!q) {
      return NextResponse.json({ products: [], orders: [], customers: [] });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const results: { products: any[]; orders: any[]; customers: any[] } = {
      products: [],
      orders: [],
      customers: [],
    };

    if (type === "all" || type === "products" || type === "skus") {
      const matchedProducts = await Product.find({
        $or: [
          { _id: regex },
          { title: regex },
          { description: regex },
          { tags: regex },
          { hsnCode: regex },
          { "colorVariants.subVariants.sku": regex },
          { "colorVariants.subVariants.barcode": regex },
        ],
      })
        .limit(10)
        .lean();

      results.products = matchedProducts.map((p) => {
        const matchingSkus: string[] = [];
        p.colorVariants?.forEach((cv: any) => {
          cv.subVariants?.forEach((sv: any) => {
            if (sv.sku && sv.sku.toLowerCase().includes(q)) {
              matchingSkus.push(sv.sku);
            }
          });
        });

        const firstSv = p.colorVariants?.[0]?.subVariants?.[0];
        const price = firstSv ? resolvePrice(firstSv, p.defaultPriceTier || "B2C") : 0;

        return {
          _id: p._id,
          title: p.title,
          slug: p.slug,
          totalStock: p.totalStock,
          price,
          matchingSkus,
        };
      });
    }

    if (type === "all" || type === "orders") {
      const matchedOrders = await Order.find({
        $or: [
          { _id: regex },
          { customerName: regex },
          { "shippingAddress.email": regex },
          { "shippingAddress.firstName": regex },
          { "shippingAddress.lastName": regex },
          { "items.sku": regex },
          { "items.productName": regex },
        ],
      })
        .limit(10)
        .lean();

      results.orders = matchedOrders.map((o: any) => ({
        _id: o._id,
        orderId: o._id,
        customerName: o.customerName || "Guest",
        status: o.status,
        totalAmount: o.amount,
        createdAt: o.createdAt || o.date,
      }));
    }

    if (type === "all" || type === "customers") {
      const matchedCustomers = await Customer.find({
        $or: [{ name: regex }, { email: regex }, { phone: regex }, { companyName: regex }],
      })
        .limit(10)
        .lean();

      results.customers = matchedCustomers.map((c) => ({
        _id: c._id,
        name: c.name,
        email: c.email,
        companyName: c.companyName,
        customerTypes: c.customerTypes,
      }));
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Admin search failed" },
      { status: 500 }
    );
  }
}
