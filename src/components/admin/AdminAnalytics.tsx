"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { formatPrice } from "@/lib/utils";
import { BarChart3, Package, AlertTriangle } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AnalyticsData {
  revenueTrend: { date: string; revenue: number }[];
  statusBreakdown: { status: string; count: number }[];
  topProducts: { title: string; sku: string; unitsSold: number }[];
  lowStockProducts: { title: string; sku: string; stock: number }[];
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

export function AdminAnalytics({ data }: { data: AnalyticsData }) {
  const { revenueTrend, statusBreakdown, topProducts, lowStockProducts } = data;

  return (
    <div className="space-y-8 text-foreground animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Revenue trends, order pipeline health, and inventory insights.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-[380px] flex flex-col">
          <CardHeader>
            <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenueAnalytics" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} dy={10} interval={4} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [formatPrice(Number(value) || 0), "Revenue"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "14px" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenueAnalytics)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="h-[380px] flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Order Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="status" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} angle={-20} textAnchor="end" height={50} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "14px" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {statusBreakdown.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Top Selling Products</CardTitle>
            <CardDescription>By total units sold across all non-cancelled orders.</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sales data yet.</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, i) => (
                  <div key={p.sku + i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-card">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-extrabold flex items-center justify-center shrink-0">{i + 1}</span>
                      <div>
                        <p className="text-sm font-semibold">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">{p.unitsSold} sold</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Low Stock Alerts</CardTitle>
            <CardDescription>Products with fewer than 15 units remaining.</CardDescription>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">All stock levels are healthy.</p>
            ) : (
              <div className="space-y-2">
                {lowStockProducts.map((p, i) => (
                  <div key={p.sku + i} className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div>
                      <p className="text-sm font-semibold">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{p.sku}</p>
                    </div>
                    <span className="text-sm font-bold text-destructive">{p.stock} left</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
