"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  IndianRupee,
  ShoppingBag,
  Layers,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Package,
  ArrowRight,
  Eye,
  Calendar,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  Wallet as WalletIcon,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Order } from "@/types";

interface DashboardData {
  totalRevenue: number;
  netSales: number;
  paidAmount: number;
  pendingAmount: number;
  cancelledAmount?: number;
  placedOrders: number;
  activeCargoLines: number;
  lowStockAlerts: number;

  compTotalRevenue?: number;
  compNetSales?: number;
  compPaidAmount?: number;
  compPendingAmount?: number;
  compCancelledAmount?: number;
  compPlacedOrders?: number;

  startDate?: string;
  endDate?: string;
  compStartDate?: string;
  compEndDate?: string;
  isComparisonActive?: boolean;

  recentOrders: Order[];
  revenueTrend: { date: string; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
  topProducts: { title: string; sku: string; unitsSold: number }[];
  lowStockProducts: { title: string; sku: string; stock: number }[];
  /** Balances held right now — a position, not a flow, so no date range applies. */
  walletTotals: { store: number; business: number; held: number; total: number; walletCount: number };
}

interface AdminOverviewProps {
  dbData: DashboardData;
}

const STATUS_COLORS: Record<string, string> = {
  Placed: "#3b82f6",
  Pending: "#f59e0b",
  Confirmed: "#6366f1",
  Processing: "#eab308",
  "Awaiting Shipment": "#f97316",
  "In Transit": "#06b6d4",
  Shipped: "#a855f7",
  Delivered: "#22c55e",
  Cancelled: "#ef4444",
};

export function AdminOverview({ dbData }: AdminOverviewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const basePath = pathname.startsWith("/manager") ? "/manager" : "/admin";

  const {
    totalRevenue,
    netSales,
    paidAmount,
    pendingAmount,
    cancelledAmount = 0,
    placedOrders,
    activeCargoLines,
    lowStockAlerts,
    walletTotals,
    compTotalRevenue = 0,
    compNetSales = 0,
    compPaidAmount = 0,
    compPendingAmount = 0,
    compPlacedOrders = 0,
    startDate = "",
    endDate = "",
    compStartDate = "",
    compEndDate = "",
    isComparisonActive = false,
    recentOrders,
    revenueTrend,
    statusBreakdown,
    topProducts,
    lowStockProducts,
  } = dbData;

  // Local Filter Form State
  const [filterStartDate, setFilterStartDate] = React.useState(startDate);
  const [filterEndDate, setFilterEndDate] = React.useState(endDate);
  const [showComparison, setShowComparison] = React.useState(isComparisonActive);
  const [filterCompStartDate, setFilterCompStartDate] = React.useState(compStartDate);
  const [filterCompEndDate, setFilterCompEndDate] = React.useState(compEndDate);
  const [activePreset, setActivePreset] = React.useState<string>("30d");

  React.useEffect(() => {
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
    setShowComparison(isComparisonActive);
    setFilterCompStartDate(compStartDate);
    setFilterCompEndDate(compEndDate);
  }, [startDate, endDate, isComparisonActive, compStartDate, compEndDate]);

  const handleApplyFilter = (overrideParams?: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    const sDate = overrideParams?.startDate !== undefined ? overrideParams.startDate : filterStartDate;
    const eDate = overrideParams?.endDate !== undefined ? overrideParams.endDate : filterEndDate;
    const isComp = overrideParams?.isComparisonActive !== undefined ? overrideParams.isComparisonActive === "true" : showComparison;
    const csDate = overrideParams?.compStartDate !== undefined ? overrideParams.compStartDate : filterCompStartDate;
    const ceDate = overrideParams?.compEndDate !== undefined ? overrideParams.compEndDate : filterCompEndDate;

    if (sDate) params.set("startDate", sDate);
    else params.delete("startDate");

    if (eDate) params.set("endDate", eDate);
    else params.delete("endDate");

    if (isComp) {
      params.set("isComparisonActive", "true");
      if (csDate) params.set("compStartDate", csDate);
      if (ceDate) params.set("compEndDate", ceDate);
    } else {
      params.set("isComparisonActive", "false");
      params.delete("compStartDate");
      params.delete("compEndDate");
    }

    router.push(`${basePath}?${params.toString()}`);
  };

  const handlePresetSelect = (preset: "today" | "7d" | "30d" | "thisMonth" | "lastMonth") => {
    setActivePreset(preset);
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === "today") {
      start = today;
      end = today;
    } else if (preset === "7d") {
      start.setDate(today.getDate() - 7);
      end = today;
    } else if (preset === "30d") {
      start.setDate(today.getDate() - 30);
      end = today;
    } else if (preset === "thisMonth") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    } else if (preset === "lastMonth") {
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
    }

    const sStr = start.toISOString().split("T")[0];
    const eStr = end.toISOString().split("T")[0];

    setFilterStartDate(sStr);
    setFilterEndDate(eStr);

    // Calculate comparison period of equal length
    const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const compEnd = new Date(start);
    compEnd.setDate(compEnd.getDate() - 1);
    const compStart = new Date(compEnd);
    compStart.setDate(compStart.getDate() - diffDays);

    const csStr = compStart.toISOString().split("T")[0];
    const ceStr = compEnd.toISOString().split("T")[0];

    setFilterCompStartDate(csStr);
    setFilterCompEndDate(ceStr);

    handleApplyFilter({
      startDate: sStr,
      endDate: eStr,
      isComparisonActive: showComparison ? "true" : "false",
      compStartDate: csStr,
      compEndDate: ceStr,
    });
  };

  const handleResetFilters = () => {
    setActivePreset("30d");
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - 30);

    const sStr = defaultStart.toISOString().split("T")[0];
    const eStr = defaultEnd.toISOString().split("T")[0];

    setFilterStartDate(sStr);
    setFilterEndDate(eStr);
    setShowComparison(false);
    setFilterCompStartDate("");
    setFilterCompEndDate("");

    router.push(basePath);
  };

  // Calculate percentage change helpers
  const getPercentChange = (current: number, previous: number) => {
    if (!previous || previous <= 0) return current > 0 ? 100 : 0;
    return Number((((current - previous) / previous) * 100).toFixed(1));
  };

  const revChange = getPercentChange(totalRevenue, compTotalRevenue);
  const netSalesChange = getPercentChange(netSales, compNetSales);
  const paidChange = getPercentChange(paidAmount, compPaidAmount);
  const pendingChange = getPercentChange(pendingAmount, compPendingAmount);
  const ordersChange = getPercentChange(placedOrders, compPlacedOrders);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-md">Delivered</span>;
      case "Cancelled":
        return <span className="px-2 py-0.5 bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-md">Cancelled</span>;
      case "Processing":
        return <span className="px-2 py-0.5 bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-md">Processing</span>;
      case "Shipped":
      case "In Transit":
        return <span className="px-2 py-0.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-md">{status}</span>;
      default:
        return <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs font-bold rounded-md">{status || "Placed"}</span>;
    }
  };

  return (
    <div className="space-y-6 text-foreground animate-in fade-in duration-500 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-xs mt-1">
            Real-time B2B revenue performance, sales breakdown, and comparison analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`${basePath}/orders`}>
            <Button size="sm" className="font-bold text-xs bg-primary text-primary-foreground">
              Manage Orders <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ─── DATE FILTER & COMPARISON TOOLBAR ─── */}
      <Card className="border border-border bg-card shadow-xs">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            {/* Presets Button Group */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Period:
              </span>
              <button
                type="button"
                onClick={() => handlePresetSelect("today")}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === "today"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("7d")}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === "7d"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("30d")}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === "30d"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                }`}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("thisMonth")}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === "thisMonth"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("lastMonth")}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  activePreset === "lastMonth"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                }`}
              >
                Last Month
              </button>
            </div>

            {/* Comparison Toggle Switch */}
            <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 rounded-lg border border-border">
              <label className="text-xs font-bold text-foreground flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showComparison}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowComparison(checked);
                    if (checked && (!filterCompStartDate || !filterCompEndDate)) {
                      // auto populate previous period dates
                      if (filterStartDate && filterEndDate) {
                        const sObj = new Date(filterStartDate);
                        const eObj = new Date(filterEndDate);
                        const diff = Math.max(1, Math.round((eObj.getTime() - sObj.getTime()) / (1000 * 60 * 60 * 24)));
                        const cEnd = new Date(sObj);
                        cEnd.setDate(cEnd.getDate() - 1);
                        const cStart = new Date(cEnd);
                        cStart.setDate(cStart.getDate() - diff);
                        setFilterCompStartDate(cStart.toISOString().split("T")[0]);
                        setFilterCompEndDate(cEnd.toISOString().split("T")[0]);
                      }
                    }
                  }}
                  className="h-4 w-4 rounded text-primary focus:ring-primary accent-emerald-600 cursor-pointer"
                />
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" /> Enable Period Comparison
                </span>
              </label>
            </div>
          </div>

          {/* Date Input Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-border">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={filterStartDate}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="text-xs h-8 bg-background"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                End Date
              </label>
              <Input
                type="date"
                value={filterEndDate}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setActivePreset("custom");
                }}
                className="text-xs h-8 bg-background"
              />
            </div>

            {showComparison ? (
              <>
                <div>
                  <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                    Comp Start Date
                  </label>
                  <Input
                    type="date"
                    value={filterCompStartDate}
                    onChange={(e) => setFilterCompStartDate(e.target.value)}
                    className="text-xs h-8 bg-amber-500/10 border-amber-500/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block mb-1">
                    Comp End Date
                  </label>
                  <Input
                    type="date"
                    value={filterCompEndDate}
                    onChange={(e) => setFilterCompEndDate(e.target.value)}
                    className="text-xs h-8 bg-amber-500/10 border-amber-500/30"
                  />
                </div>
              </>
            ) : (
              <div className="hidden lg:block lg:col-span-2" />
            )}

            <div className="flex items-end gap-2">
              <Button
                onClick={() => handleApplyFilter()}
                size="sm"
                className="h-8 text-xs font-bold bg-primary text-primary-foreground flex-1 cursor-pointer"
              >
                <Filter className="h-3.5 w-3.5 mr-1" /> Apply Filter
              </Button>
              <Button
                onClick={handleResetFilters}
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold border-border cursor-pointer px-2.5"
                title="Reset Filters"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KPI CARDS GRID (Including Net Sales, Paid & Pending Amount) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Revenue */}
        <Card className="hover:shadow-md transition-shadow border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatPrice(totalRevenue)}</div>
            {showComparison ? (
              <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${revChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {revChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revChange >= 0 ? `+${revChange}%` : `${revChange}%`} vs comparison period
              </p>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Live Gross Sales
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. Net Sales */}
        <Card className="hover:shadow-md transition-shadow border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Sales</CardTitle>
            <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatPrice(netSales)}</div>
            {showComparison ? (
              <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${netSalesChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {netSalesChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {netSalesChange >= 0 ? `+${netSalesChange}%` : `${netSalesChange}%`} vs comp
              </p>
            ) : (
              <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                {cancelledAmount > 0
                  ? `Deducted cancelled orders (${formatPrice(cancelledAmount)}) & discounts`
                  : "Net sales (after coupons & cancelled deductions)"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 3. Paid Amount */}
        <Card className="hover:shadow-md transition-shadow border-emerald-500/30 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Paid Amount</CardTitle>
            <div className="p-2 bg-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatPrice(paidAmount)}</div>
            {showComparison ? (
              <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${paidChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {paidChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {paidChange >= 0 ? `+${paidChange}%` : `${paidChange}%`} vs comp
              </p>
            ) : (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                Verified received payments
              </p>
            )}
          </CardContent>
        </Card>

        {/* 4. Pending Amount */}
        <Card className="hover:shadow-md transition-shadow border-amber-500/30 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending Amount</CardTitle>
            <div className="p-2 bg-amber-500/15 rounded-xl text-amber-600 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{formatPrice(pendingAmount)}</div>
            {showComparison ? (
              <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${pendingChange >= 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {pendingChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pendingChange >= 0 ? `+${pendingChange}%` : `${pendingChange}%`} vs comp
              </p>
            ) : (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
                Pending credit / receivables
              </p>
            )}
          </CardContent>
        </Card>

        {/* 5. Placed Orders */}
        <Card className="hover:shadow-md transition-shadow border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Placed Orders</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{placedOrders}</div>
            {showComparison ? (
              <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${ordersChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {ordersChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {ordersChange >= 0 ? `+${ordersChange}%` : `${ordersChange}%`} vs comp
              </p>
            ) : (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Orders in period
              </p>
            )}
          </CardContent>
        </Card>

        {/* 6. Active Product Lines */}
        <Card className="hover:shadow-md transition-shadow border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Catalog Items</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-xl text-purple-600 dark:text-purple-400">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{activeCargoLines}</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Live products in catalog
            </p>
          </CardContent>
        </Card>

        {/* 7. Low Stock Alerts */}
        <Card className="hover:shadow-md transition-shadow border-amber-500/30 bg-card sm:col-span-2 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Low Stock Inventory Alerts</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{lowStockAlerts} Products</div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1">
              Products with fewer than 15 units remaining in warehouse inventory
            </p>
          </CardContent>
        </Card>
      </div>

      {/*
        ─── CUSTOMER WALLET LIABILITY ───

        Deliberately outside the KPI grid above and not affected by the date pickers: every
        card up there is a *flow* over the selected period, while this is a *position* held
        right now. Putting it in the same grid would invite reading it as "wallet revenue for
        the last 30 days", which it is not.

        The total is the headline because that is the money the business owes its customers;
        the split below says where it sits.
      */}
      <Card className="border-emerald-500/30 bg-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Customer Wallet Balance
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Money held across {walletTotals.walletCount} active wallet{walletTotals.walletCount === 1 ? "" : "s"} — not tied to the date range
            </p>
          </div>
          <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
            <WalletIcon className="h-4 w-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatPrice(walletTotals.total)}
          </div>

          {/*
            Two breakdowns, then the held amount as a *note* rather than a third column.
            Held is not a third wallet — it is part of the two above, temporarily reserved.
            Giving it equal visual weight invited reading the three as a sum of the total.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Store Wallet</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">{formatPrice(walletTotals.store)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Business Wallet</p>
              <p className="text-xl font-bold font-mono text-foreground mt-0.5">{formatPrice(walletTotals.business)}</p>
            </div>
          </div>

          <div className="mt-3 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2">
            <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
              {formatPrice(walletTotals.held)} on hold
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Reserved by in-flight checkouts — included in the total above
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 30-Day Revenue Trend */}
        <Card className="h-[380px] flex flex-col border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>Revenue Trend Chart</span>
              <span className="text-xs font-normal text-muted-foreground">Period Daily Buckets</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenueOverview" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={10} interval={Math.max(0, Math.floor(revenueTrend.length / 7))} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  formatter={(value: any) => [formatPrice(Number(value) || 0), "Revenue"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenueOverview)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Order Status Breakdown Bar Chart */}
        <Card className="h-[380px] flex flex-col border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Order Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 pt-2">
            {statusBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No orders recorded in this period pipeline.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={45} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {statusBreakdown.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.status] || "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grid: Recent Orders & Top Selling Products / Inventory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Recent B2B Orders */}
        <Card className="lg:col-span-2 border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
            <div>
              <CardTitle className="text-base font-bold">Recent Orders</CardTitle>
              <CardDescription className="text-xs">Latest customer purchase requests and commercial orders.</CardDescription>
            </div>
            <Link href={`${basePath}/orders`}>
              <Button variant="ghost" size="sm" className="text-xs font-bold text-primary hover:text-primary">
                View All &rarr;
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No orders recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-secondary/30 text-muted-foreground uppercase text-[10px] font-bold border-b">
                    <tr>
                      <th className="p-3">Order ID</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentOrders.map((o: any) => (
                      <tr key={o._id} className="hover:bg-secondary/20 transition-colors">
                        <td className="p-3 font-mono font-bold text-foreground">{o._id}</td>
                        <td className="p-3">
                          <p className="font-semibold text-foreground">{o.customerName}</p>
                          <p className="text-[10px] text-muted-foreground">{o.shippingAddress?.email || o.customerEmail}</p>
                        </td>
                        <td className="p-3 text-center">{getStatusBadge(o.status)}</td>
                        <td className="p-3 text-right font-bold text-foreground">{formatPrice(o.amount)}</td>
                        <td className="p-3 text-right">
                          <Link href={`${basePath}/orders/${o._id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 cursor-pointer">
                              <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Col: Top Products & Low Stock Insights */}
        <div className="space-y-6">
          {/* Top Selling Products */}
          <Card className="border border-border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Top Selling Products
              </CardTitle>
              <CardDescription className="text-[11px]">By units sold across all non-cancelled orders.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {topProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No sales data recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={p.sku + i} className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-secondary/10">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate text-foreground">{p.title}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-primary shrink-0 ml-2">{p.unitsSold} sold</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alerts List */}
          <Card className="border border-amber-500/20">
            <CardHeader className="pb-3 border-b border-amber-500/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Low Stock Inventory
              </CardTitle>
              <CardDescription className="text-[11px]">Items requiring inventory replenishment.</CardDescription>
            </CardHeader>
            <CardContent className="pt-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 text-center py-4 font-medium">
                  ✓ All active inventory levels are healthy.
                </p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map((p, i) => (
                    <div key={p.sku + i} className="flex items-center justify-between p-2 rounded-lg border border-amber-200 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10">
                      <div className="truncate">
                        <p className="text-xs font-bold text-foreground truncate">{p.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 ml-2">
                        {p.stock} in stock
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
