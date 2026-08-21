import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Manager from "@/models/Manager";
import Order from "@/models/Order";
import Invoice from "@/models/Invoice";
import { verifyToken, getTokenFromCookie } from "@/lib/auth";
import { isManagerMatch } from "@/lib/managerAttribution";

export async function GET(request: Request) {
  try {
    await dbConnect();
    const token = await getTokenFromCookie();
    if (!token) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload || payload.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const managers = await Manager.find().select("-password").sort({ name: 1 }).lean();
    const orders = await Order.find().lean();
    const invoices = await Invoice.find().lean();

    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const reportRows = managers.map((mgr: any) => {
      const mgrOrders = orders.filter((o: any) =>
        isManagerMatch(mgr, o.createdBy) ||
        isManagerMatch(mgr, o.salesperson) ||
        isManagerMatch(mgr, o.salespersonEmail) ||
        isManagerMatch(mgr, o.managerEmail)
      );

      const mgrInvoices = invoices.filter((inv: any) =>
        isManagerMatch(mgr, inv.createdBy) ||
        isManagerMatch(mgr, inv.salesperson) ||
        isManagerMatch(mgr, inv.salespersonEmail) ||
        isManagerMatch(mgr, inv.managerEmail)
      );

      const quotes = mgrInvoices.filter((i: any) => i.type === "quote");
      /**
       * `accepted` is a quote's successful outcome; `converted` and `approved` are legacy.
       *
       * Quotes are standalone estimates and no longer become orders, so nothing produces
       * `converted` any more. Omitting `accepted` here — as this did — would have pinned
       * every manager's rate at 0% the moment the conversion flow was removed.
       *
       * The output field names stay `convertedQuotesCount` / `quoteConversionRate`: they are
       * the shape of the KPI response and of the CSV export, and renaming them would break
       * both for a label.
       */
      const convertedQuotes = quotes.filter(
        (i: any) => i.status === "accepted" || i.status === "converted" || i.status === "approved"
      );

      const totalOrderRevenue = mgrOrders.reduce((s: number, o: any) => s + (o.amount || 0), 0);
      const totalQuoteRevenue = convertedQuotes.reduce((s: number, q: any) => s + (q.amount || 0), 0);
      const totalRevenueInfluenced = totalOrderRevenue + totalQuoteRevenue;

      const quoteConversionRate = quotes.length > 0 ? Number(((convertedQuotes.length / quotes.length) * 100).toFixed(1)) : 0;

      // 60-day attendance
      const history60 = (mgr.loginHistory || []).filter((h: any) => new Date(h.loginTime) >= sixtyDaysAgo);
      let activeMinutes = 0;
      history60.forEach((log: any) => {
        if (log.loginTime && log.logoutTime) {
          const diffMs = new Date(log.logoutTime).getTime() - new Date(log.loginTime).getTime();
          if (diffMs > 0) activeMinutes += Math.round(diffMs / (1000 * 60));
        }
      });

      return {
        id: String(mgr._id),
        name: mgr.name,
        email: mgr.email,
        role: mgr.assignedRole || "Staff Manager",
        status: mgr.status,
        permissionsCount: (mgr.permissions || []).length,
        ordersCount: mgrOrders.length,
        totalOrderRevenue,
        quotesCount: quotes.length,
        convertedQuotesCount: convertedQuotes.length,
        quoteConversionRate,
        totalRevenueInfluenced,
        activeHours60Days: Number((activeMinutes / 60).toFixed(1)),
        totalSessions60Days: history60.length
      };
    });

    // Check if CSV format is requested
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "csv") {
      let csv = "Manager Name,Email,Assigned Role,Status,Permissions,Orders Handled,Order Revenue (INR),Quotes Issued,Quotes Converted,Conversion Rate (%),Total Revenue Influenced (INR),Active Working Hours (60 Days),Total Sessions (60 Days)\n";
      reportRows.forEach((r: any) => {
        csv += `"${r.name}","${r.email}","${r.role}","${r.status}",${r.permissionsCount},${r.ordersCount},${r.totalOrderRevenue},${r.quotesCount},${r.convertedQuotesCount},${r.quoteConversionRate}%,${r.totalRevenueInfluenced},${r.activeHours60Days},${r.totalSessions60Days}\n`;
      });

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="FlexSell_Staff_KPI_Report_${new Date().toISOString().split("T")[0]}.csv"`
        }
      });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalStaffCount: managers.length,
      reportRows
    });
  } catch (error: any) {
    console.error("Team KPI Report error:", error);
    return NextResponse.json({ message: error.message || "Failed to generate KPI report" }, { status: 500 });
  }
}
