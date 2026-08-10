"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Users, UserCheck, Trophy, Briefcase } from "lucide-react";
import { Manager } from "@/app/(dashboard)/admin/managers/page";
import { Order } from "@/types";
import { isManagerMatch } from "@/lib/managerAttribution";

interface ManagerAnalyticsHeaderProps {
  managers: Manager[];
  orders?: Order[];
  invoices?: any[];
  activeFilter: "all" | "active" | "full_access" | "recent";
  onFilterChange: (filter: "all" | "active" | "full_access" | "recent") => void;
  getPermissionSummary: (perms?: string[]) => { count: number; total: number; isFull: boolean; text: string };
}

export function ManagerAnalyticsHeader({
  managers,
  orders = [],
  invoices = [],
  activeFilter,
  onFilterChange,
}: ManagerAnalyticsHeaderProps) {
  const totalCount = managers.length;

  // Currently Logged In (Active) Staff
  const currentlyLoggedInCount = React.useMemo(() => {
    return managers.filter((m) => {
      if (m.status !== "active") return false;
      if (!m.lastLogin) return false;
      if (!m.lastLogout) return true;
      return new Date(m.lastLogin).getTime() > new Date(m.lastLogout).getTime();
    }).length;
  }, [managers]);

  // Calculate Top 3 Managers by Orders + Quotes count using unified Manager Attribution Engine
  const managerPerformance = React.useMemo(() => {
    const countsMap: Record<string, { id: string; name: string; count: number }> = {};

    // Initialize all registered managers with 0 count
    managers.forEach((m) => {
      countsMap[m._id] = { id: m._id, name: m.name, count: 0 };
    });

    const addDocAttribution = (doc: any) => {
      const identifier = doc.createdBy || doc.salesperson || doc.salespersonEmail || doc.managerEmail;
      if (!identifier) return;

      const matchedMgr = managers.find((m) => isManagerMatch(m, identifier));
      if (matchedMgr) {
        countsMap[matchedMgr._id].count += 1;
      } else {
        const rawName = typeof identifier === "string" ? identifier : identifier.name || "Unknown Staff";
        const key = `raw_${rawName.toLowerCase()}`;
        if (countsMap[key]) {
          countsMap[key].count += 1;
        } else {
          countsMap[key] = { id: key, name: rawName, count: 1 };
        }
      }
    };

    orders.forEach(addDocAttribution);
    invoices.forEach(addDocAttribution);

    const sortedList = Object.values(countsMap).sort((a, b) => b.count - a.count);
    return sortedList.slice(0, 3);
  }, [managers, orders, invoices]);

  // Total Volume Handled
  const totalOrdersAndQuotesCount = React.useMemo(() => {
    return orders.length + invoices.length;
  }, [orders, invoices]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* Card 1: Total Team Size */}
      <Card
        onClick={() => onFilterChange("all")}
        className={`bg-card/70 dark:bg-zinc-900/60 backdrop-blur-xs border transition-all cursor-pointer shadow-xs ${
          activeFilter === "all"
            ? "border-primary/80 ring-1 ring-primary/40 bg-primary/5"
            : "border-border/70 hover:border-primary/40"
        }`}
      >
        <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              Total Team Size
            </p>
            <h3 className="text-xl sm:text-2xl font-black font-mono text-foreground">{totalCount}</h3>
            <p className="text-[11px] text-muted-foreground font-medium">Registered Staff Accounts</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Currently Logged In (Active) */}
      <Card
        onClick={() => onFilterChange(activeFilter === "active" ? "all" : "active")}
        className={`bg-card/70 dark:bg-zinc-900/60 backdrop-blur-xs border transition-all cursor-pointer shadow-xs ${
          activeFilter === "active"
            ? "border-emerald-500/80 ring-1 ring-emerald-500/40 bg-emerald-500/5"
            : "border-border/70 hover:border-emerald-500/40"
        }`}
      >
        <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Currently Logged In</p>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {currentlyLoggedInCount}
            </h3>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Active Portal Sessions
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Top 3 Managers (Most Orders + Quotes) */}
      <Card className="bg-card/70 dark:bg-zinc-900/60 backdrop-blur-xs border border-border/70 shadow-xs p-3.5 sm:p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
              Top Performers
            </p>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-1">
            {managerPerformance.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No manager stats available</p>
            ) : (
              managerPerformance.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] leading-tight">
                  <span className="font-semibold text-foreground/90 truncate max-w-[120px]">
                    {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"} {item.name}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground font-semibold shrink-0">
                    {item.count} {item.count === 1 ? "doc" : "docs"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-medium mt-1 border-t border-border/40 pt-1">
          Most Orders & Quotes Created
        </p>
      </Card>

      {/* Card 4: Total Volume Managed */}
      <Card className="bg-card/70 dark:bg-zinc-900/60 backdrop-blur-xs border border-border/70 shadow-xs">
        <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total Managed Volume</p>
            <h3 className="text-xl sm:text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {totalOrdersAndQuotesCount}
            </h3>
            <p className="text-[11px] text-muted-foreground font-medium">Orders & Quotes Created</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Briefcase className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
