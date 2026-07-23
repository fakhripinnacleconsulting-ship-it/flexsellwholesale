import * as React from "react";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { Order as OrderType } from "@/types";

export default async function AdminDashboardPage() {
  let orders: any[] = [];
  let productsCount = 0;
  let lowStockCount = 0;
  let recentOrders: any[] = [];
  let totalOrders = 0;

  try {
    await dbConnect();

    const [ordersRes, pCount, lsCount, rOrders, tOrders] = await Promise.all([
      Order.find({ status: { $ne: "Cancelled" } }).select("amount createdAt").lean(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ totalStock: { $lt: 15 }, isActive: true }),
      Order.find().sort({ createdAt: -1 }).limit(5).lean(),
      Order.countDocuments()
    ]);
    orders = ordersRes;
    productsCount = pCount;
    lowStockCount = lsCount;
    recentOrders = rOrders;
    totalOrders = tOrders;
  } catch (err) {
    console.error("AdminDashboardPage DB fetch notice:", (err as any)?.message || err);
  }

  const totalRevenue = orders.reduce((sum, order) => sum + (order.amount || 0), 0);

  // Generate 7-day revenue trend
  const chartDataMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    chartDataMap[dateStr] = 0;
  }

  (orders as any[]).forEach(o => {
    const d = new Date(o.createdAt);
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (chartDataMap[dateStr] !== undefined) {
      chartDataMap[dateStr] += o.amount;
    }
  });

  const revenueTrend = Object.keys(chartDataMap).map(date => ({
    date,
    revenue: chartDataMap[date]
  }));

  // Ensure plain objects for client component
  const recentOrdersPlain = JSON.parse(JSON.stringify(recentOrders));

  return (
    <AdminOverview 
      dbData={{
        totalRevenue,
        placedOrders: totalOrders,
        activeCargoLines: productsCount,
        lowStockAlerts: lowStockCount,
        recentOrders: recentOrdersPlain,
        revenueTrend
      }} 
    />
  );
}
