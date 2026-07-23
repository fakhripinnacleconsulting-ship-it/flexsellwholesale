"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { IndianRupee, ShoppingBag, Layers, AlertTriangle, TrendingUp } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Order } from "@/types";

interface DashboardData {
  totalRevenue: number;
  placedOrders: number;
  activeCargoLines: number;
  lowStockAlerts: number;
  recentOrders: Order[];
  revenueTrend: { date: string; revenue: number }[];
}

interface AdminOverviewProps {
  dbData: DashboardData;
}

export function AdminOverview({ dbData }: AdminOverviewProps) {
  const { totalRevenue, placedOrders, activeCargoLines, lowStockAlerts, recentOrders, revenueTrend } = dbData;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Delivered":
        return <span className="px-2 py-1 bg-success/20 text-success text-xs font-medium rounded-md">Delivered</span>;
      case "Cancelled":
        return <span className="px-2 py-1 bg-destructive/20 text-destructive text-xs font-medium rounded-md">Cancelled</span>;
      case "Processing":
        return <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-medium rounded-md">Processing</span>;
      case "Shipped":
        return <span className="px-2 py-1 bg-blue-500/20 text-blue-500 text-xs font-medium rounded-md">Shipped</span>;
      default:
        return <span className="px-2 py-1 bg-muted text-muted-foreground text-xs font-medium rounded-md">{status}</span>;
    }
  };

  return (
    <div className="space-y-8 text-foreground animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening in your B2B warehouse today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total B2B Revenue</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <IndianRupee className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
            <p className="text-xs text-success mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" /> Original from DB
            </p>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Placed Orders</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{placedOrders}</div>
            <p className="text-xs text-success mt-1 flex items-center">
              <TrendingUp className="h-3 w-3 mr-1" /> Dynamic orders log
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Cargo Lines</CardTitle>
            <div className="p-2 bg-primary/10 rounded-full">
              <Layers className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCargoLines}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Live products in catalog
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
            <div className="p-2 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Products with stock &lt; 15 units
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-[400px] flex flex-col">
          <CardHeader>
            <CardTitle>Revenue Trend (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `₹${value / 1000}k`} />
                <Tooltip 
                  formatter={(value: any) => [formatPrice(Number(value) || 0), "Revenue"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", fontSize: "14px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        <Card className="h-[400px] flex flex-col">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {recentOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm italic">No B2B orders generated yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order._id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-semibold text-sm">Order {order._id}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.customerName}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <p className="font-bold text-sm">{formatPrice(order.amount)}</p>
                      {getStatusBadge(order.status)}
                    </div>
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
