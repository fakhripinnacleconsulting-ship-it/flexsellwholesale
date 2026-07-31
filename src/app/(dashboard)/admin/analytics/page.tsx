import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = ["Placed", "Pending", "Confirmed", "Processing", "Awaiting Shipment", "In Transit", "Shipped", "Delivered", "Cancelled"];

export default async function AdminAnalyticsPage() {
  let revenueTrend: { date: string; revenue: number }[] = [];
  let statusBreakdown: { status: string; count: number }[] = [];
  let topProducts: { title: string; sku: string; unitsSold: number }[] = [];
  let lowStockProducts: { title: string; sku: string; stock: number }[] = [];

  try {
    await dbConnect();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [ordersLast30, statusAgg, salesAgg, lowStock] = await Promise.all([
      Order.find({ status: { $ne: "Cancelled" }, createdAt: { $gte: thirtyDaysAgo } } as any).select("amount createdAt").lean(),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        { $match: { status: { $ne: "Cancelled" } } },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.productId", { $ifNull: ["$items.product._id", "$items.product"] }] },
            totalQty: { $sum: { $ifNull: ["$items.quantity", 0] } }
          }
        },
        { $sort: { totalQty: -1 } },
        { $limit: 8 }
      ]),
      Product.find({ isActive: true, totalStock: { $lt: 15 } }).select("title totalStock colorVariants").sort({ totalStock: 1 }).limit(10).lean()
    ]);

    // Revenue trend — daily buckets across the last 30 days
    const chartDataMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      chartDataMap[dateStr] = 0;
    }
    for (const o of ordersLast30 as any[]) {
      const dateStr = new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (chartDataMap[dateStr] !== undefined) chartDataMap[dateStr] += o.amount;
    }
    revenueTrend = Object.keys(chartDataMap).map((date) => ({ date, revenue: chartDataMap[date] }));

    // Status breakdown — only show statuses that actually have orders, in a stable pipeline order
    const statusCountMap: Record<string, number> = {};
    for (const row of statusAgg as any[]) {
      if (row._id) statusCountMap[row._id] = row.count;
    }
    statusBreakdown = ORDER_STATUSES.filter((s) => statusCountMap[s]).map((s) => ({ status: s, count: statusCountMap[s] }));

    // Top products — resolve product title/SKU for each aggregated productId
    const productIds = (salesAgg as any[]).map((r) => r._id).filter(Boolean).map(String);
    const products = await Product.find({ _id: { $in: productIds } }).select("title colorVariants").lean();
    const productMap: Record<string, any> = {};
    for (const p of products as any[]) productMap[p._id] = p;

    topProducts = (salesAgg as any[])
      .filter((r) => r._id && productMap[String(r._id)])
      .map((r) => {
        const p = productMap[String(r._id)];
        return {
          title: p.title,
          sku: p.colorVariants?.[0]?.subVariants?.[0]?.sku || "—",
          unitsSold: r.totalQty || 0,
        };
      });

    lowStockProducts = (lowStock as any[]).map((p) => ({
      title: p.title,
      sku: p.colorVariants?.[0]?.subVariants?.[0]?.sku || "—",
      stock: p.totalStock,
    }));
  } catch (err) {
    console.error("AdminAnalyticsPage DB fetch notice:", (err as any)?.message || err);
  }

  return (
    <AdminAnalytics
      data={{
        revenueTrend,
        statusBreakdown,
        topProducts,
        lowStockProducts,
      }}
    />
  );
}
