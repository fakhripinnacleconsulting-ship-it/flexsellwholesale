"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useOrderStore } from "@/stores/orderStore";
import { formatPrice } from "@/lib/utils";
import { apiClient } from "@/lib/apiClient";
import { ExecutiveKpiCard } from "@/components/managers/ExecutiveKpiCard";
import { CreatedByBadge } from "@/components/common/CreatedByBadge";
import {
  Shield,
  Clock,
  ShieldCheck,
  FileText,
  TrendingUp,
  CheckCircle2,
  ShoppingCart,
  Percent,
  User,
  Mail,
  Calendar,
  ArrowUpRight,
  Sparkles,
  Layers,
  Activity,
  FileSpreadsheet,
} from "lucide-react";

export default function ManagerDashboardOverview() {
  const { manager } = useAuthStore();
  const [isMounted, setIsMounted] = React.useState(false);
  const { invoices, initializeInvoices } = useInvoiceStore();
  const { orders, initializeOrders } = useOrderStore();
  const [managerDetail, setManagerDetail] = React.useState<any>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    // Initialize quotes/invoices and orders with "me" filter
    initializeInvoices({ limit: 100, createdBy: "me" });
    initializeOrders({ limit: 100, createdBy: "me" });

    if (manager?._id) {
      apiClient.get<any>(`/admin/managers/${manager._id}`)
        .then((res) => setManagerDetail(res))
        .catch((err) => console.error("Failed to load manager detailed KPIs:", err));
    }
  }, [initializeInvoices, initializeOrders, manager?._id]);

  if (!isMounted || !manager) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading manager session...
      </div>
    );
  }

  // Filter manager's own created quotes and orders
  const myInvoices = invoices.filter((i) => {
    if (i.createdBy?.userId) {
      return i.createdBy.userId === manager._id || i.createdBy.email === manager.email;
    }
    if (i.createdBy?.name) {
      return manager.name && i.createdBy.name.toLowerCase() === manager.name.toLowerCase();
    }
    if (i.generatedBy) {
      const handle = manager.email ? manager.email.split("@")[0].toLowerCase() : "";
      const mgrName = manager.name ? manager.name.toLowerCase() : "";
      const gen = i.generatedBy.toLowerCase();
      return (handle && gen.includes(handle)) || (mgrName && gen.includes(mgrName));
    }
    return true;
  });

  const myQuotes = myInvoices.filter((i) => i.type === "quote");
  const myConvertedQuotes = myQuotes.filter((q) => q.status === "converted");
  const myDraftQuotes = myQuotes.filter((q) => q.status === "draft");
  const mySentQuotes = myQuotes.filter((q) => q.status === "sent");
  const myFinalizedQuotes = myQuotes.filter((q) => q.status === "finalized");

  const totalQuoteValue = myQuotes.reduce((sum, q) => sum + (q.amount || 0), 0);
  const conversionRate =
    myQuotes.length > 0
      ? Math.round((myConvertedQuotes.length / myQuotes.length) * 100)
      : 0;

  const myOrders = orders.filter((o) => {
    if (o.createdBy?.userId) {
      return o.createdBy.userId === manager._id || o.createdBy.email === manager.email;
    }
    if (o.createdBy?.name) {
      return manager.name && o.createdBy.name.toLowerCase() === manager.name.toLowerCase();
    }
    return true;
  });

  const totalOrderValue = myOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

  // Initials for avatar
  const initials = manager.name
    ? manager.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "MG";

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200 pb-12">
      {/* 1. Manager Profile Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-900 via-emerald-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Sparkles className="w-80 h-80" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400/40 backdrop-blur-md flex items-center justify-center text-2xl sm:text-3xl font-black text-emerald-300 shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {manager.name}
                </h1>
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  {manager.status || "Active"}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs sm:text-sm text-slate-300 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-emerald-400" />
                  {manager.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  {manager.assignedRole || "Staff Manager"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-emerald-400" />
                  Joined {new Date(manager.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-start md:justify-end border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <Link href="/manager/documents/quotes">
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-md">
                <FileSpreadsheet className="h-4 w-4" /> Quotes Portal
              </Button>
            </Link>
            <Link href="/manager/orders/b2b">
              <Button size="sm" variant="secondary" className="font-bold gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <ShoppingCart className="h-4 w-4" /> Orders Portal
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Synchronized Executive KPI Analytics Section */}
      {managerDetail?.kpis ? (
        <ExecutiveKpiCard manager={manager} kpis={managerDetail.kpis} showTitleBanner={true} />
      ) : (
        <div className="p-6 text-center text-xs text-muted-foreground border rounded-xl bg-card">
          Loading synchronized B2B Executive KPIs...
        </div>
      )}

      {/* 3. Detailed Profile & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile & Account Details Card */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="border-b bg-secondary/20 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-emerald-600" /> Account Profile Details
            </CardTitle>
            <CardDescription className="text-xs">
              Personal credentials and workspace configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col gap-1 border-b pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Full Name
              </span>
              <span className="text-sm font-semibold text-foreground">{manager.name}</span>
            </div>

            <div className="flex flex-col gap-1 border-b pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Email Address
              </span>
              <span className="text-sm font-mono font-medium text-foreground">{manager.email}</span>
            </div>

            <div className="flex flex-col gap-1 border-b pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Role
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {manager.assignedRole || "Staff Manager"}
              </span>
            </div>

            <div className="flex flex-col gap-1 border-b pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Last Active Session
              </span>
              <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {manager.lastLogin ? new Date(manager.lastLogin).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                }) : "First Active Session"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Granted Privileges
              </span>
              <span className="text-xs font-semibold text-foreground">
                {manager.permissions?.length || 0} active module permissions assigned
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Quotes Status Distribution */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="border-b bg-secondary/20 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-600" /> Quotation Status Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Status breakdown of quotes generated by {manager.name}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Converted to Orders
                </span>
                <span>{myConvertedQuotes.length} ({conversionRate}%)</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${conversionRate}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-blue-600">Sent to Customer</span>
                <span>{mySentQuotes.length}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      myQuotes.length > 0 ? (mySentQuotes.length / myQuotes.length) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-amber-600">Draft Status</span>
                <span>{myDraftQuotes.length}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      myQuotes.length > 0 ? (myDraftQuotes.length / myQuotes.length) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-purple-600">Finalized Quotes</span>
                <span>{myFinalizedQuotes.length}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full transition-all duration-500"
                  style={{
                    width: `${
                      myQuotes.length > 0 ? (myFinalizedQuotes.length / myQuotes.length) * 100 : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Module Permissions Grid */}
        <Card className="border border-border shadow-xs">
          <CardHeader className="border-b bg-secondary/20 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-600" /> Assigned Permissions
            </CardTitle>
            <CardDescription className="text-xs">
              Operational modules authorized by Master Admin
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {manager.permissions?.length === 0 ? (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 text-xs font-medium">
                No permissions currently assigned. Contact Master Admin.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {manager.permissions?.map((perm: string) => (
                  <span
                    key={perm}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-secondary text-foreground border border-border flex items-center gap-1.5 capitalize"
                  >
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    {perm.replace("_", " ")}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Recent Quotes & Orders Generated by Me */}
      <Card className="border border-border shadow-xs">
        <CardHeader className="border-b flex flex-row items-center justify-between p-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Recent Documents Created by Me
            </CardTitle>
            <CardDescription className="text-xs">
              Latest quotations generated under your manager profile
            </CardDescription>
          </div>
          <Link href="/manager/documents/quotes">
            <Button variant="ghost" size="sm" className="text-xs font-bold gap-1">
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] font-bold border-b">
                <tr>
                  <th className="p-3">Document ID</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Created By</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myQuotes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground italic">
                      No recent quotations found under your profile.
                    </td>
                  </tr>
                ) : (
                  myQuotes.slice(0, 5).map((q) => (
                    <tr key={q._id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">{q._id}</td>
                      <td className="p-3 font-semibold text-foreground">{q.customerName}</td>
                      <td className="p-3">
                        <CreatedByBadge createdBy={q.createdBy} generatedBy={q.generatedBy} customerName={q.customerName} docType={q.type} />
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        {formatPrice(q.amount)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary text-foreground">
                          {q.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Link href={`/manager/documents/${q._id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 font-semibold">
                            View Quote
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
