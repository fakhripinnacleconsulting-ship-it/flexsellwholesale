import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import Order from "@/models/Order";
import Invoice from "@/models/Invoice";
import Customer from "@/models/Customer";
import StockLog from "@/models/StockLog";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const managerId = params.id;

    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const managerDoc = await Manager.findById(managerId);
    if (!managerDoc) {
      return NextResponse.json({ message: "Manager not found" }, { status: 404 });
    }

    const isSelf = payload.role === "manager" && (payload.userId === managerId || payload.email === managerDoc.email);
    if (payload.role !== "admin" && !isSelf) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // 1. Automatic DB Cleanup: Purge loginHistory entries older than 60 days
    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const origHistoryLen = (managerDoc.loginHistory || []).length;
    
    managerDoc.loginHistory = (managerDoc.loginHistory || []).filter((h: any) => new Date(h.loginTime) >= sixtyDaysAgo);
    if (managerDoc.loginHistory.length !== origHistoryLen) {
      await managerDoc.save();
    }

    const manager = managerDoc.toObject();
    delete manager.password;

    const perms: string[] = manager.permissions || [];
    const hasAnyPerm = (prefix: string) => perms.some(p => p.startsWith(prefix));

    // Multi-field deep regex matching with token support for accurate attributions
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameTokens = manager.name.trim().split(/\s+/).filter((t: string) => t.length >= 2);
    const emailPrefix = manager.email.trim().split("@")[0];
    const idStr = String(manager._id);

    const matchPatterns = [
      new RegExp(escapeRegex(manager.name), "i"),
      new RegExp(escapeRegex(manager.email), "i"),
      new RegExp(escapeRegex(emailPrefix), "i"),
      ...nameTokens.map((t: string) => new RegExp(`\\b${escapeRegex(t)}\\b`, "i"))
    ];

    const commonMatchFilter = {
      $or: [
        { salesperson: { $in: matchPatterns } },
        { salespersonEmail: { $in: matchPatterns } },
        { "createdBy.userId": idStr },
        { "createdBy.email": { $in: matchPatterns } },
        { "createdBy.name": { $in: matchPatterns } },
        { managerEmail: { $in: matchPatterns } },
        { managerId: idStr }
      ]
    };

    let orders: any[] = [];
    let invoices: any[] = [];
    let customers: any[] = [];
    let stockLogs: any[] = [];

    // On-demand lazy fetching based on permissions or fallback
    if (hasAnyPerm("orders_") || hasAnyPerm("invoices_") || perms.length === 0) {
      orders = await Order.find(commonMatchFilter).sort({ createdAt: -1 }).limit(100).lean();
    }

    if (hasAnyPerm("invoices_") || perms.length === 0) {
      invoices = await Invoice.find(commonMatchFilter).sort({ createdAt: -1 }).limit(100).lean();
    }

    if (hasAnyPerm("customers_") || perms.length === 0) {
      customers = await Customer.find(commonMatchFilter).sort({ createdAt: -1 }).limit(50).lean();
    }

    if (hasAnyPerm("catalog_") || hasAnyPerm("ops_") || perms.length === 0) {
      stockLogs = await StockLog.find({
        $or: [
          { updatedBy: { $in: matchPatterns } },
          { updatedByEmail: { $in: matchPatterns } },
          { managerId: idStr }
        ]
      }).sort({ createdAt: -1 }).limit(50).lean();
    }

    // 2. Compute Researched B2B Wholesale KPI Indicators
    const completedOrders = orders.filter(o => o.status === "delivered" || o.status === "shipped" || o.status === "completed");
    const totalOrderRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const highValueDealsCount = orders.filter(o => (o.amount || 0) >= 50000).length;
    const averageOrderValue = orders.length > 0 ? Math.round(totalOrderRevenue / orders.length) : 0;

    const quotes = invoices.filter(i => i.type === "quote");
    const totalQuotesCount = quotes.length;
    const convertedQuotes = quotes.filter(i => i.status === "converted" || i.status === "approved" || i.status === "accepted");
    const convertedQuotesCount = convertedQuotes.length;
    const quoteConversionRate = totalQuotesCount > 0 ? Number(((convertedQuotesCount / totalQuotesCount) * 100).toFixed(1)) : 0;
    const convertedQuoteRevenue = convertedQuotes.reduce((sum, q) => sum + (q.amount || 0), 0);

    const totalRevenueInfluenced = totalOrderRevenue + convertedQuoteRevenue;

    const shippedOrdersCount = orders.filter(o => o.status === "shipped" || o.status === "delivered").length;
    const fulfillmentExecutionRate = orders.length > 0 ? Number(((shippedOrdersCount / orders.length) * 100).toFixed(1)) : 0;

    // 3. Attendance & Working Hours (60-Day Audit)
    let totalActiveMinutes = 0;
    let autoLogout10pmCount = 0;
    const loginHistory = manager.loginHistory || [];

    loginHistory.forEach((log: any) => {
      if (log.logoutReason === "auto_10pm") autoLogout10pmCount += 1;
      if (log.loginTime && log.logoutTime) {
        const diffMs = new Date(log.logoutTime).getTime() - new Date(log.loginTime).getTime();
        if (diffMs > 0) totalActiveMinutes += Math.round(diffMs / (1000 * 60));
      }
    });

    const totalActiveHours60Days = Number((totalActiveMinutes / 60).toFixed(1));
    const avgSessionMinutes = loginHistory.length > 0 ? Math.round(totalActiveMinutes / loginHistory.length) : 0;

    // Composite Productivity Index Score (Out of 100)
    let productivityScore = 40; // Base score
    if (orders.length > 0) productivityScore += Math.min(25, orders.length * 5);
    if (quoteConversionRate > 0) productivityScore += Math.min(20, Math.round(quoteConversionRate * 0.2));
    if (customers.length > 0) productivityScore += Math.min(10, customers.length * 2);
    if (stockLogs.length > 0) productivityScore += Math.min(5, stockLogs.length);
    productivityScore = Math.min(100, Math.max(0, productivityScore));

    return NextResponse.json({
      manager,
      kpis: {
        // Financial & Commercial KPIs
        totalRevenueInfluenced,
        totalOrderRevenue,
        averageOrderValue,
        highValueDealsCount,
        
        // Conversion & Pipeline KPIs
        totalQuotesCount,
        convertedQuotesCount,
        quoteConversionRate,
        convertedQuoteRevenue,
        
        // Fulfillment & Operational KPIs
        totalOrdersCount: orders.length,
        shippedOrdersCount,
        fulfillmentExecutionRate,
        totalCustomersManaged: customers.length,
        totalStockActionsCount: stockLogs.length,

        // Attendance & Discipline KPIs (60 Days)
        totalSessions60Days: loginHistory.length,
        totalActiveHours60Days,
        avgSessionMinutes,
        autoLogout10pmCount,

        // Overall Performance Index
        productivityScore
      },
      workLogs: {
        orders,
        invoices,
        customers,
        stockLogs
      }
    });
  } catch (error: any) {
    console.error("Fetch Manager Detail API error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch manager details" }, { status: 500 });
  }
}
