"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useToastStore } from "@/stores/toastStore";
import { apiClient } from "@/lib/apiClient";
import { formatPrice } from "@/lib/utils";
import {
  ArrowLeft, Shield, Users, ShoppingBag, FileText,
  Clock, CheckCircle, AlertTriangle, Activity, Package, Mail, MessageSquare, Briefcase,
  TrendingUp, Award, Download, ShieldCheck, Zap
} from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminManagerDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  const managerId = resolvedParams.id;
  const router = useRouter();
  const { addToast } = useToastStore();

  const [isLoading, setIsLoading] = React.useState(true);
  const [data, setData] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<string>("kpi_report");

  const fetchManagerDetail = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get<any>(`/admin/managers/${managerId}`);
      setData(res);
    } catch (err: any) {
      addToast(err.message || "Failed to load manager details", "error");
    } finally {
      setIsLoading(false);
    }
  }, [managerId, addToast]);

  React.useEffect(() => {
    fetchManagerDetail();
  }, [fetchManagerDetail]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Loading Manager Profile & KPI Report...</h2>
        <p className="text-muted-foreground text-xs">Retrieving 60-day session logs and multi-field work attributions.</p>
      </div>
    );
  }

  if (!data || !data.manager) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground space-y-4">
        <h2 className="text-xl font-bold mb-2">Manager Not Found</h2>
        <p className="text-muted-foreground text-xs">The requested manager record could not be found.</p>
        <Link href="/admin/managers">
          <Button variant="outline" size="sm">Back to Manager List</Button>
        </Link>
      </div>
    );
  }

  const { manager, kpis, workLogs } = data;
  const perms: string[] = manager.permissions || [];
  const hasPerm = (prefix: string) => perms.some(p => p.startsWith(prefix) || p === prefix);

  // Dynamic Tabs evaluation based on assigned RBAC permissions
  const dynamicTabs = [
    { id: "kpi_report", label: "Executive KPI Report", icon: Award, always: true },
    { id: "overview", label: "Account Credentials", icon: Activity, always: true },
    ...(hasPerm("orders_") ? [{ id: "orders", label: "Orders Work Log", icon: ShoppingBag, count: workLogs?.orders?.length || 0 }] : []),
    ...(hasPerm("invoices_") ? [{ id: "invoices", label: "Invoices & Quotes", icon: FileText, count: workLogs?.invoices?.length || 0 }] : []),
    ...(hasPerm("customers_") ? [{ id: "customers", label: "Customers Managed", icon: Users, count: workLogs?.customers?.length || 0 }] : []),
    ...(hasPerm("catalog_") ? [{ id: "catalog", label: "Catalog Edits", icon: Package, count: workLogs?.stockLogs?.length || 0 }] : []),
    { id: "login_history", label: "60-Day Login Audit & Auto-Logout", icon: Clock, count: manager.loginHistory?.length || 0, always: true },
  ];

  const handlePrintKpiReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 text-foreground container mx-auto px-4 py-8 max-w-6xl">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-8 w-8 cursor-pointer"
            onClick={() => router.push("/admin/managers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar initials={manager.name.substring(0, 2).toUpperCase()} className="bg-primary text-primary-foreground h-11 w-11 border text-sm font-bold shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{manager.name}</h1>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                manager.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}>
                {manager.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <span>{manager.email}</span>
              <span>•</span>
              <span className="font-semibold text-primary">{manager.assignedRole || "Staff Manager"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrintKpiReport} className="font-bold text-xs gap-1.5 cursor-pointer">
            <Download className="h-3.5 w-3.5" /> Print / Export KPI Summary
          </Button>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-secondary/80 text-foreground border border-border flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-primary" /> {perms.length} RBAC Modules
          </span>
        </div>
      </div>

      {/* Dynamic Tab Selector Bar */}
      <div className="flex items-center gap-1.5 border-b pb-2 overflow-x-auto custom-scrollbar">
        {dynamicTabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <IconComponent className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab: Executive KPI Report (DEFAULT INITIAL TAB) */}
      {activeTab === "kpi_report" && (
        <div className="space-y-6">
          {/* Executive KPI Score Banner */}
          <Card className="bg-gradient-to-r from-primary/10 via-background to-secondary/30 border border-primary/20 shadow-md">
            <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  <Zap className="h-3.5 w-3.5" /> Researched B2B Wholesale KPI Card
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">{manager.name} — Performance Summary</h2>
                <p className="text-xs text-muted-foreground">Comprehensive evaluation of revenue contribution, quote conversion efficiency, and 60-day attendance discipline.</p>
              </div>

              {/* Composite Score Gauge */}
              <div className="flex items-center gap-4 bg-card/80 p-4 rounded-xl border border-border shadow-xs shrink-0">
                <div className="text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Productivity Index</p>
                  <p className="text-3xl font-black font-mono text-primary">{kpis?.productivityScore || 0}<span className="text-sm text-muted-foreground">/100</span></p>
                </div>
                <div className="w-24 bg-secondary h-3 rounded-full overflow-hidden border border-border">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${kpis?.productivityScore || 0}%` }}></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4 Core B2B KPI Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Revenue Influenced */}
            <Card className="bg-card/70 border shadow-xs p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Revenue Influenced</p>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Briefcase className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {formatPrice(kpis?.totalRevenueInfluenced || 0)}
              </h3>
              <p className="text-[11px] text-muted-foreground flex justify-between">
                <span>Orders: {formatPrice(kpis?.totalOrderRevenue || 0)}</span>
                <span className="font-semibold text-foreground">{kpis?.highValueDealsCount || 0} Large Deals</span>
              </p>
            </Card>

            {/* KPI 2: Quote Conversion Rate */}
            <Card className="bg-card/70 border shadow-xs p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Quote Conversion Rate</p>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                {kpis?.quoteConversionRate || 0}%
              </h3>
              <p className="text-[11px] text-muted-foreground flex justify-between">
                <span>{kpis?.convertedQuotesCount || 0} Converted</span>
                <span>{kpis?.totalQuotesCount || 0} Issued Quotes</span>
              </p>
            </Card>

            {/* KPI 3: Fulfillment Execution */}
            <Card className="bg-card/70 border shadow-xs p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Fulfillment Rate</p>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <ShoppingBag className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                {kpis?.fulfillmentExecutionRate || 0}%
              </h3>
              <p className="text-[11px] text-muted-foreground flex justify-between">
                <span>{kpis?.shippedOrdersCount || 0} Shipped</span>
                <span>{kpis?.totalOrdersCount || 0} Orders Handled</span>
              </p>
            </Card>

            {/* KPI 4: 60-Day Working Hours */}
            <Card className="bg-card/70 border shadow-xs p-4 space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Active Hours (60 Days)</p>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <h3 className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {kpis?.totalActiveHours60Days || 0} hrs
              </h3>
              <p className="text-[11px] text-muted-foreground flex justify-between">
                <span>{kpis?.totalSessions60Days || 0} Sessions</span>
                <span>{kpis?.autoLogout10pmCount || 0} Auto 10 PM Logouts</span>
              </p>
            </Card>
          </div>

          {/* Detailed Metric Analysis Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">B2B Commercial & Operational Efficiency</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Average Order Value (AOV):</span>
                  <span className="font-mono font-bold text-foreground">{formatPrice(kpis?.averageOrderValue || 0)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Converted Quote Revenue:</span>
                  <span className="font-mono font-bold text-emerald-600">{formatPrice(kpis?.convertedQuoteRevenue || 0)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Customer Accounts Serviced:</span>
                  <span className="font-bold text-foreground">{kpis?.totalCustomersManaged || 0} Managed Accounts</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Catalog & Stock Maintenance Edits:</span>
                  <span className="font-bold text-foreground">{kpis?.totalStockActionsCount || 0} Inventory Actions</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Session Working Time:</span>
                  <span className="font-mono font-bold">{kpis?.avgSessionMinutes || 0} mins per session</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Discipline & Compliance</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Auto 10 PM Logouts:</span>
                  <span className="font-mono font-bold text-amber-600">{kpis?.autoLogout10pmCount || 0}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">60-Day Audit Retention:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">● Auto DB Clean Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Staff RBAC Role:</span>
                  <span className="font-semibold text-primary">{manager.assignedRole || "Staff Manager"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab: Account Credentials */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Account Credentials & Access</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Full Name:</span>
                <span className="font-bold text-foreground">{manager.name}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Email Address:</span>
                <span className="font-mono font-bold text-foreground">{manager.email}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Assigned Role:</span>
                <span className="font-semibold text-primary">{manager.assignedRole || "Staff Manager"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Account Created:</span>
                <span>{new Date(manager.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Session Login:</span>
                <span className="font-mono">{manager.lastLogin ? new Date(manager.lastLogin).toLocaleString() : "Never"}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Assigned Permissions</span>
                <span className="text-xs font-semibold text-primary">{perms.length} Active</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 text-xs">
              {perms.length === 0 ? (
                <p className="text-muted-foreground italic">No granular permissions assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {perms.map((p, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-secondary/80 text-foreground border border-border">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Orders Work Log */}
      {activeTab === "orders" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Orders Attributed to {manager.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 uppercase text-muted-foreground font-bold border-b">
                  <tr>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!workLogs?.orders || workLogs.orders.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">No orders attributed to this manager.</td>
                    </tr>
                  ) : (
                    workLogs.orders.map((o: any) => (
                      <tr key={o._id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary">{o._id}</td>
                        <td className="p-3 font-bold">{o.customerName}</td>
                        <td className="p-3">{o.orderType || "B2B"}</td>
                        <td className="p-3 font-bold font-mono">{formatPrice(o.amount)}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {o.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{o.date || new Date(o.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Invoices & Quotes */}
      {activeTab === "invoices" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Invoices & Quotes Attributed to {manager.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 uppercase text-muted-foreground font-bold border-b">
                  <tr>
                    <th className="p-3">Document ID</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Document Type</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Generated Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!workLogs?.invoices || workLogs.invoices.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">No invoices or quotes attributed to this manager.</td>
                    </tr>
                  ) : (
                    workLogs.invoices.map((inv: any) => (
                      <tr key={inv._id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-3 font-mono font-bold text-primary">{inv._id}</td>
                        <td className="p-3 font-bold">{inv.customerName}</td>
                        <td className="p-3 uppercase font-semibold text-[10px]">{inv.type}</td>
                        <td className="p-3 font-bold font-mono">{formatPrice(inv.amount)}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            {inv.status}
                          </span>
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{inv.generatedAt || new Date(inv.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Customers Log */}
      {activeTab === "customers" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Customers Managed by {manager.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 uppercase text-muted-foreground font-bold border-b">
                  <tr>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Company</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!workLogs?.customers || workLogs.customers.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">No customer records directly managed by this staff.</td>
                    </tr>
                  ) : (
                    workLogs.customers.map((c: any) => (
                      <tr key={c._id} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-3 font-bold">{c.name}</td>
                        <td className="p-3 font-mono text-muted-foreground">{c.email}</td>
                        <td className="p-3">{c.company || "N/A"}</td>
                        <td className="p-3">{(c.customerTypes || []).join(", ") || "B2C"}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{c.status || "Active"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: Catalog Activity */}
      {activeTab === "catalog" && (
        <Card>
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Stock & Catalog Edits by {manager.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 uppercase text-muted-foreground font-bold border-b">
                  <tr>
                    <th className="p-3">Item / Product</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Quantity Delta</th>
                    <th className="p-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!workLogs?.stockLogs || workLogs.stockLogs.length === 0) ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-muted-foreground">No catalog or stock logs recorded for this manager.</td>
                    </tr>
                  ) : (
                    workLogs.stockLogs.map((st: any, i: number) => (
                      <tr key={i} className="hover:bg-secondary/10 transition-colors">
                        <td className="p-3 font-bold">{st.productTitle || st.productName || "Product"}</td>
                        <td className="p-3 uppercase text-[10px] font-bold">{st.action || st.type || "Update"}</td>
                        <td className="p-3 font-mono font-bold">{st.quantityDelta || st.quantity || 0}</td>
                        <td className="p-3 text-right text-muted-foreground">{new Date(st.createdAt).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab: 60-Day Login & Logout Audit */}
      {activeTab === "login_history" && (
        <Card>
          <CardHeader className="border-b pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">60-Day Login & Logout Audit Log</CardTitle>
              <CardDescription className="text-xs">Automatic database cleanup purges session logs older than 60 days.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ● 60-Day DB Clean Active
              </span>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded">
                {(manager.loginHistory || []).length} Sessions
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 uppercase text-muted-foreground font-bold border-b">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Login Time</th>
                    <th className="p-3">Logout Time</th>
                    <th className="p-3">Session Duration</th>
                    <th className="p-3 text-right">Logout Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!manager.loginHistory || manager.loginHistory.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">No login session logs recorded in the past 60 days.</td>
                    </tr>
                  ) : (
                    [...manager.loginHistory].reverse().map((log: any, index: number) => {
                      const loginDate = new Date(log.loginTime);
                      const logoutDate = log.logoutTime ? new Date(log.logoutTime) : null;
                      
                      let durationStr = "Active Session";
                      if (logoutDate) {
                        const diffMinutes = Math.max(1, Math.round((logoutDate.getTime() - loginDate.getTime()) / (1000 * 60)));
                        const hours = Math.floor(diffMinutes / 60);
                        const mins = diffMinutes % 60;
                        durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} mins`;
                      }

                      return (
                        <tr key={index} className="hover:bg-secondary/10 transition-colors">
                          <td className="p-3 font-mono text-muted-foreground">{index + 1}</td>
                          <td className="p-3 font-mono font-semibold text-foreground">
                            {loginDate.toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-muted-foreground">
                            {logoutDate ? logoutDate.toLocaleString() : <span className="text-emerald-600 font-bold">● Active Now</span>}
                          </td>
                          <td className="p-3 font-bold">{durationStr}</td>
                          <td className="p-3 text-right">
                            {log.logoutReason === "auto_10pm" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                🌙 Auto 10:00 PM Logout
                              </span>
                            ) : log.logoutReason === "expired" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                                Session Expired
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground">
                                Manual Logout
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
