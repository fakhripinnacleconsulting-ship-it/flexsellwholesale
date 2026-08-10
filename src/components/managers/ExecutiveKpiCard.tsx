"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatPrice } from "@/lib/utils";
import {
  Briefcase, TrendingUp, ShoppingBag, Clock, Activity, Award, Zap
} from "lucide-react";

interface ExecutiveKpiCardProps {
  manager: any;
  kpis: any;
  showTitleBanner?: boolean;
}

export function ExecutiveKpiCard({ manager, kpis, showTitleBanner = true }: ExecutiveKpiCardProps) {
  if (!manager || !kpis) return null;

  return (
    <div className="space-y-6">
      {/* Executive KPI Score Banner */}
      {showTitleBanner && (
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
      )}

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
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Commercial & Operational Efficiency</CardTitle>
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
  );
}
