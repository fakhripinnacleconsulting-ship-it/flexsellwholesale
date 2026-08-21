import { formatDateIST } from "@/lib/datetime";
import * as React from "react";
import dbConnect from "@/lib/dbConnect";
import Order from "@/models/Order";
import Product from "@/models/Product";
import AdvanceBalance from "@/models/AdvanceBalance";
import { toRupees } from "@/lib/money";
import { AdminOverview } from "@/components/admin/AdminOverview";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = [
  "Placed",
  "Pending",
  "Confirmed",
  "Processing",
  "Awaiting Shipment",
  "In Transit",
  "Shipped",
  "Delivered",
  "Cancelled",
];

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    compStartDate?: string;
    compEndDate?: string;
    isComparisonActive?: string;
  }>;
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Primary Date Range Setup (Default to Last 30 Days if not specified)
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);

  const startDateStr = params.startDate || defaultStart.toISOString().split("T")[0];
  const endDateStr = params.endDate || defaultEnd.toISOString().split("T")[0];

  const startDateObj = new Date(startDateStr);
  const endDateObj = new Date(endDateStr);
  endDateObj.setHours(23, 59, 59, 999);

  // Comparison Date Range Setup
  const isComparisonActive = params.isComparisonActive === "true" || (Boolean(params.compStartDate) && Boolean(params.compEndDate));
  let compStartDateStr = params.compStartDate || "";
  let compEndDateStr = params.compEndDate || "";

  if (isComparisonActive && (!compStartDateStr || !compEndDateStr)) {
    const periodDays = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    const compEnd = new Date(startDateObj);
    compEnd.setDate(compEnd.getDate() - 1);
    const compStart = new Date(compEnd);
    compStart.setDate(compStart.getDate() - periodDays);

    compStartDateStr = compStart.toISOString().split("T")[0];
    compEndDateStr = compEnd.toISOString().split("T")[0];
  }

  let totalRevenue = 0;
  let netSales = 0;
  let paidAmount = 0;
  let pendingAmount = 0;
  let cancelledAmount = 0;
  let totalOrders = 0;
  let productsCount = 0;
  let lowStockCount = 0;
  let recentOrders: any[] = [];

  let compTotalRevenue = 0;
  let compNetSales = 0;
  let compPaidAmount = 0;
  let compPendingAmount = 0;
  let compCancelledAmount = 0;
  let compPlacedOrders = 0;

  /**
   * Customer Advance Balance money the business is holding.
   *
   * Deliberately **not** scoped to the dashboard's date range: a balance is a position, not a
   * flow. "How much customer money do we hold" has one answer, today, regardless of which
   * period the revenue cards are showing.
   *
   * Closed advanceBalances are excluded — their balance is settled and no longer a liability.
   */
  let advanceBalanceTotals = { store: 0, business: 0, held: 0, total: 0, advanceBalanceCount: 0 };

  let revenueTrend: { date: string; revenue: number }[] = [];
  let statusBreakdown: { status: string; count: number }[] = [];
  let topProducts: { title: string; sku: string; unitsSold: number }[] = [];
  let lowStockProducts: { title: string; sku: string; stock: number }[] = [];

  try {
    await dbConnect();

    const primaryMatch = {
      status: { $ne: "Cancelled" },
      createdAt: { $gte: startDateObj, $lte: endDateObj },
    };

    const [
      primaryAgg,
      cancelledAgg,
      ordersInPeriod,
      pCount,
      lsCount,
      rOrders,
      statusAgg,
      salesAgg,
      lowStockList,
    ] = await Promise.all([
      Order.aggregate([
        { $match: primaryMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$amount" },
            couponDiscounts: { $sum: { $ifNull: ["$couponDiscount", 0] } },
            paidAmount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$amount", 0] },
            },
            pendingAmount: {
              $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$amount", 0] },
            },
            orderCount: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            status: "Cancelled",
            createdAt: { $gte: startDateObj, $lte: endDateObj },
          },
        },
        {
          $group: {
            _id: null,
            cancelledAmount: { $sum: "$amount" },
          },
        },
      ]),
      Order.find(primaryMatch as any).select("amount createdAt").lean(),
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ totalStock: { $lt: 15 }, isActive: true }),
      Order.find().sort({ createdAt: -1 }).limit(6).lean(),
      Order.aggregate([
        { $match: { createdAt: { $gte: startDateObj, $lte: endDateObj } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: primaryMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: { $ifNull: ["$items.productId", { $ifNull: ["$items.product._id", "$items.product"] }] },
            totalQty: { $sum: { $ifNull: ["$items.quantity", 0] } },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 6 },
      ]),
      Product.find({ isActive: true, totalStock: { $lt: 15 } })
        .select("title totalStock colorVariants")
        .sort({ totalStock: 1 })
        .limit(6)
        .lean(),
    ]);

    cancelledAmount = cancelledAgg && cancelledAgg[0]?.cancelledAmount ? cancelledAgg[0].cancelledAmount : 0;

    if (primaryAgg && primaryAgg[0]) {
      totalRevenue = primaryAgg[0].totalRevenue || 0;
      const couponDiscounts = primaryAgg[0].couponDiscounts || 0;
      // Net Sales = Total Gross Revenue - Cancelled Amount - Coupon Discounts
      netSales = Math.max(0, totalRevenue - cancelledAmount - couponDiscounts);
      paidAmount = primaryAgg[0].paidAmount || 0;
      pendingAmount = primaryAgg[0].pendingAmount || 0;
      totalOrders = primaryAgg[0].orderCount || 0;
    }

    productsCount = pCount;
    lowStockCount = lsCount;
    recentOrders = rOrders;

    // Comparison Period Aggregation if enabled
    if (isComparisonActive && compStartDateStr && compEndDateStr) {
      const compStartObj = new Date(compStartDateStr);
      const compEndObj = new Date(compEndDateStr);
      compEndObj.setHours(23, 59, 59, 999);

      const [compAgg, compCancelledAgg] = await Promise.all([
        Order.aggregate([
          {
            $match: {
              status: { $ne: "Cancelled" },
              createdAt: { $gte: compStartObj, $lte: compEndObj },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$amount" },
              couponDiscounts: { $sum: { $ifNull: ["$couponDiscount", 0] } },
              paidAmount: {
                $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$amount", 0] },
              },
              pendingAmount: {
                $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$amount", 0] },
              },
              orderCount: { $sum: 1 },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              status: "Cancelled",
              createdAt: { $gte: compStartObj, $lte: compEndObj },
            },
          },
          {
            $group: {
              _id: null,
              cancelledAmount: { $sum: "$amount" },
            },
          },
        ]),
      ]);

      compCancelledAmount = compCancelledAgg && compCancelledAgg[0]?.cancelledAmount ? compCancelledAgg[0].cancelledAmount : 0;

      if (compAgg && compAgg[0]) {
        compTotalRevenue = compAgg[0].totalRevenue || 0;
        const compCouponDiscounts = compAgg[0].couponDiscounts || 0;
        compNetSales = Math.max(0, compTotalRevenue - compCancelledAmount - compCouponDiscounts);
        compPaidAmount = compAgg[0].paidAmount || 0;
        compPendingAmount = compAgg[0].pendingAmount || 0;
        compPlacedOrders = compAgg[0].orderCount || 0;
      }
    }

    // Revenue Trend daily buckets for primary date range
    const diffDays = Math.max(1, Math.round((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)));
    const chartDataMap: Record<string, number> = {};

    for (let i = diffDays; i >= 0; i--) {
      const d = new Date(endDateObj);
      d.setDate(d.getDate() - i);
      const dateStr = formatDateIST(d);
      chartDataMap[dateStr] = 0;
    }
    for (const o of ordersInPeriod as any[]) {
      const dateStr = formatDateIST(new Date(o.createdAt));
      if (chartDataMap[dateStr] !== undefined) chartDataMap[dateStr] += o.amount;
    }
    revenueTrend = Object.keys(chartDataMap).map((date) => ({ date, revenue: chartDataMap[date] }));

    // Status breakdown
    const statusCountMap: Record<string, number> = {};
    for (const row of statusAgg as any[]) {
      if (row._id) statusCountMap[row._id] = row.count;
    }
    statusBreakdown = ORDER_STATUSES.filter((s) => statusCountMap[s]).map((s) => ({
      status: s,
      count: statusCountMap[s],
    }));

    // Top Selling Products
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

    lowStockProducts = (lowStockList as any[]).map((p) => ({
      title: p.title,
      sku: p.colorVariants?.[0]?.subVariants?.[0]?.sku || "—",
      stock: p.totalStock,
    }));

    /**
     * Advance Balance balances, summed by type.
     *
     * advanceBalances store **integer paise**; everything else on this dashboard is rupees, so the
     * conversion happens here, once, before the numbers leave the server.
     */
    const advanceBalanceAgg = await AdvanceBalance.aggregate([
      { $match: { status: { $ne: "closed" } } },
      {
        $group: {
          _id: "$type",
          available: { $sum: "$availableBalance" },
          held: { $sum: "$heldBalance" },
          count: { $sum: 1 },
        },
      },
    ]);

    for (const row of advanceBalanceAgg as { _id: string; available: number; held: number; count: number }[]) {
      const availableRupees = toRupees(row.available || 0);
      if (row._id === "store") advanceBalanceTotals.store = availableRupees;
      if (row._id === "business") advanceBalanceTotals.business = availableRupees;
      advanceBalanceTotals.held += toRupees(row.held || 0);
      advanceBalanceTotals.advanceBalanceCount += row.count || 0;
    }
    // The headline figure: everything the business is holding, spendable or on hold.
    advanceBalanceTotals.total = advanceBalanceTotals.store + advanceBalanceTotals.business + advanceBalanceTotals.held;
  } catch (err) {
    console.error("AdminDashboardPage DB fetch notice:", (err as any)?.message || err);
  }

  const recentOrdersPlain = JSON.parse(JSON.stringify(recentOrders));

  return (
    <AdminOverview
      dbData={{
        totalRevenue,
        netSales,
        paidAmount,
        pendingAmount,
        cancelledAmount,
        placedOrders: totalOrders,
        activeCargoLines: productsCount,
        lowStockAlerts: lowStockCount,

        compTotalRevenue,
        compNetSales,
        compPaidAmount,
        compPendingAmount,
        compCancelledAmount,
        compPlacedOrders,

        startDate: startDateStr,
        endDate: endDateStr,
        compStartDate: compStartDateStr,
        compEndDate: compEndDateStr,
        isComparisonActive,

        recentOrders: recentOrdersPlain,
        revenueTrend,
        statusBreakdown,
        topProducts,
        lowStockProducts,
        advanceBalanceTotals,
      }}
    />
  );
}
