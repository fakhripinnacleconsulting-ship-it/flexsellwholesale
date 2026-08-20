"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { apiClient } from "@/lib/apiClient";
import {
  Users,
  TrendingUp,
  Wallet as WalletIcon,
  AlertTriangle,
  Loader2,
  RefreshCw,
  UserPlus,
  Crown,
  Info,
} from "lucide-react";

/**
 * Customer-base analytics above the customer list.
 *
 * Three things this layout is careful about, each of which had been got wrong:
 *
 *  1. **It follows the page's customer-type filter**, so the numbers always describe the list
 *     underneath them.
 *  2. **Only some of it moves with the date range.** Revenue and new signups are flows and
 *     belong to a period; customer counts, wallet balances and outstanding work are positions
 *     that are simply true right now. Each card carries a scope chip saying which it is —
 *     without that, a wallet balance sitting under a "This Week" filter reads as income.
 *  3. **Nothing is presented as a total that is not one.** A customer can hold several types,
 *     so the type figures are *overlapping memberships*, not slices of the customer count —
 *     showing them as a breakdown under a total made them look like broken arithmetic
 *     (6 customers, "B2B 2 · B2C 6 · Dropshipping 1"). They are now labelled for what they
 *     are, and say so.
 */

export type AnalyticsRange = "week" | "month" | "year" | "3m" | "all" | "custom";

interface CustomerAnalytics {
  scope: { customerType: string; startDate: string; endDate: string };
  segments: { total: number; B2B: number; B2C: number; Dropshipping: number };
  wallet: {
    total: number;
    store: number;
    business: number;
    held: number;
    customersWithBalance: number;
    lowBalanceWallets: number;
  };
  actionNeeded: {
    upgradesPending: number;
    kycIncomplete: number;
    dormant: number;
    dormantAfterDays: number;
  };
  growth: { newCustomers: number };
  revenue: {
    total: number;
    orders: number;
    buyingCustomers: number;
    averageOrderValue: number;
    revenuePerBuyer: number;
  };
  topCustomers: { id: string; name: string; spend: number; orders: number }[];
}

const RANGE_LABELS: { key: AnalyticsRange; label: string }[] = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
  { key: "3m", label: "Last 3 Months" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

/**
 * The scope chip for a figure the date range does not move.
 *
 * A customer count, a wallet balance and an outstanding-KYC count are true right now; only
 * revenue and new signups belong to a period. Saying so on the card is what lets both live
 * in one grid without the balance being read as the period's income.
 */
const LIVE_SCOPE = { text: "Live now", live: true };

/** Resolves a preset to the dates the API expects. `all` is a sentinel, not a date. */
function resolveRange(range: AnalyticsRange, customStart: string, customEnd: string) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().split("T")[0];

  if (range === "all") return { startDate: "all", endDate: "all" };
  if (range === "custom") return { startDate: customStart, endDate: customEnd };

  const end = iso(today);
  if (range === "week") {
    // Week starts Monday — the working week these buyers actually operate on.
    const start = new Date(today);
    const dayFromMonday = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - dayFromMonday);
    return { startDate: iso(start), endDate: end };
  }
  if (range === "month") {
    return { startDate: iso(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: end };
  }
  if (range === "year") {
    return { startDate: iso(new Date(today.getFullYear(), 0, 1)), endDate: end };
  }
  const start = new Date(today);
  start.setMonth(start.getMonth() - 3);
  return { startDate: iso(start), endDate: end };
}

export function CustomerAnalyticsPanel({ customerType }: { customerType: string }) {
  const [range, setRange] = React.useState<AnalyticsRange>("3m");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [data, setData] = React.useState<CustomerAnalytics | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    // A half-filled custom range would query a nonsense window; wait for both ends.
    if (range === "custom" && (!customStart || !customEnd)) return;

    setIsLoading(true);
    setError("");
    try {
      const { startDate, endDate } = resolveRange(range, customStart, customEnd);
      const params = new URLSearchParams({ startDate, endDate });
      if (customerType) params.set("customerType", customerType);
      const res = await apiClient.get<CustomerAnalytics>(`/customers/analytics?${params.toString()}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customer analytics.");
    } finally {
      setIsLoading(false);
    }
  }, [range, customStart, customEnd, customerType]);

  React.useEffect(() => {
    load();
  }, [load]);

  const periodLabel = RANGE_LABELS.find((r) => r.key === range)?.label || "Selected period";
  const attentionTotal = data
    ? data.actionNeeded.upgradesPending + data.actionNeeded.kycIncomplete + data.actionNeeded.dormant
    : 0;

  return (
    <div className="space-y-5">
      {/* ─── Range controls ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-lg bg-secondary/50 border border-border">
          {RANGE_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                range === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs h-9 w-auto"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs h-9 w-auto"
            />
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={isLoading}
          className="h-9 text-xs cursor-pointer ml-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {isLoading && !data ? (
        <Card className="border-border">
          <CardContent className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs font-medium">Loading customer analytics…</p>
          </CardContent>
        </Card>
      ) : data ? (
        <div className={isLoading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/*
            One grid, not two sections.

            The split into "Current Position" / "Selected Period" existed to stop a wallet
            balance being read as period income. That is still a real risk, so the distinction
            has not been dropped — it moved onto each card as a scope chip, which says the same
            thing where the number actually is instead of in a heading someone has to scroll
            back to.
          */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total customers, then types as their own labelled block */}
            <Card className="border-border">
              <CardContent className="p-5">
                <StatHeader icon={<Users className="h-4 w-4" />} tone="primary" label="Total Customers" scope={LIVE_SCOPE} />
                <p className="text-3xl font-black text-foreground mt-2">{data.segments.total}</p>

                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">
                    Customer Types
                  </p>
                  <div className="space-y-1.5">
                    <TypeRow label="B2B" count={data.segments.B2B} total={data.segments.total} />
                    <TypeRow label="B2C" count={data.segments.B2C} total={data.segments.total} />
                    <TypeRow
                      label="Dropshipping"
                      count={data.segments.Dropshipping}
                      total={data.segments.total}
                    />
                  </div>
                  {/*
                    Says why these can exceed the total, rather than leaving it to look like a
                    mistake. One account can be both B2B and Dropshipping.
                  */}
                  <p className="text-[10px] text-muted-foreground mt-2.5 flex items-start gap-1">
                    <Info className="h-3 w-3 mt-px shrink-0" />
                    <span>An account can hold more than one type, so these may total more than {data.segments.total}.</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Wallet — total highlighted, Store + Business breakdown, held as a note */}
            <Card className="border-emerald-500/30">
              <CardContent className="p-5">
                <StatHeader
                  icon={<WalletIcon className="h-4 w-4" />}
                  tone="emerald"
                  label="Wallet Balance Held"
                  scope={LIVE_SCOPE}
                />
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                  {formatPrice(data.wallet.total)}
                </p>

                <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Store Wallet
                    </p>
                    <p className="text-base font-bold font-mono text-foreground mt-0.5">
                      {formatPrice(data.wallet.store)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                      Business Wallet
                    </p>
                    <p className="text-base font-bold font-mono text-foreground mt-0.5">
                      {formatPrice(data.wallet.business)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-md bg-amber-500/5 border border-amber-500/20 px-2.5 py-2">
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                    {formatPrice(data.wallet.held)} on hold
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Reserved by in-flight checkouts — included in the total above
                  </p>
                </div>

                <p className="text-[10px] text-muted-foreground mt-2.5">
                  {data.wallet.customersWithBalance} customer
                  {data.wallet.customersWithBalance === 1 ? "" : "s"} hold a balance
                  {data.wallet.lowBalanceWallets > 0
                    ? ` · ${data.wallet.lowBalanceWallets} wallet${data.wallet.lowBalanceWallets === 1 ? "" : "s"} running low`
                    : ""}
                </p>
              </CardContent>
            </Card>

            {/* Needs attention — headline counts everything the sub-lines list */}
            <Card className={attentionTotal > 0 ? "border-amber-500/40" : "border-border"}>
              <CardContent className="p-5">
                <StatHeader
                  icon={<AlertTriangle className="h-4 w-4" />}
                  tone="amber"
                  label="Needs Attention"
                  scope={LIVE_SCOPE}
                />
                <p
                  className={`text-3xl font-black mt-2 ${
                    attentionTotal > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                  }`}
                >
                  {attentionTotal}
                </p>

                <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                  <AttentionRow label="Upgrade requests" count={data.actionNeeded.upgradesPending} />
                  <AttentionRow label="Incomplete KYC" count={data.actionNeeded.kycIncomplete} />
                  <AttentionRow
                    label={`Dormant (${data.actionNeeded.dormantAfterDays}d)`}
                    count={data.actionNeeded.dormant}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5">
                <StatHeader icon={<TrendingUp className="h-4 w-4" />} tone="indigo" label="Revenue" scope={{ text: periodLabel }} />
                <p className="text-3xl font-black text-foreground mt-2">
                  {formatPrice(data.revenue.total)}
                </p>
                <div className="mt-4 pt-4 border-t border-border space-y-1.5">
                  <MetaRow label="Orders" value={String(data.revenue.orders)} />
                  <MetaRow label="Avg order value" value={formatPrice(data.revenue.averageOrderValue)} />
                  <MetaRow
                    label="Customers who bought"
                    value={String(data.revenue.buyingCustomers)}
                  />
                  <MetaRow label="Revenue per buyer" value={formatPrice(data.revenue.revenuePerBuyer)} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5">
                <StatHeader icon={<UserPlus className="h-4 w-4" />} tone="sky" label="New Customers" scope={{ text: periodLabel }} />
                <p className="text-3xl font-black text-foreground mt-2">{data.growth.newCustomers}</p>
                <p className="text-[11px] text-muted-foreground mt-2">
                  {/* The period is already on the chip above — this says what is counted. */}
                  New accounts created in this period
                </p>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-5">
                <StatHeader icon={<Crown className="h-4 w-4" />} tone="violet" label="Top Customers by Spend" scope={{ text: periodLabel }} />
                {data.topCustomers.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-4 py-4 text-center">
                    No orders in this period.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {data.topCustomers.map((c, idx) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 min-w-0">
                          <span
                            className={`flex items-center justify-center h-5 w-5 rounded shrink-0 text-[10px] font-black ${
                              idx === 0
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold text-foreground block truncate">{c.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {c.orders} order{c.orders === 1 ? "" : "s"}
                            </span>
                          </span>
                        </span>
                        <span className="font-bold font-mono text-foreground shrink-0">
                          {formatPrice(c.spend)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

/**
 * A card's title, its icon, and — the part that matters — what its number is scoped to.
 *
 * `scope` replaces the section headings this panel used to be split by. Some figures move
 * with the date range and some are true right now whatever it says; without that stated on
 * the card, a wallet balance sitting under a "This Week" filter reads as a week's income.
 */
function StatHeader({
  icon,
  tone,
  label,
  scope,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  label: string;
  scope: { text: string; live?: boolean };
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
        <span
          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
            scope.live
              ? "bg-secondary text-muted-foreground"
              : "bg-primary/10 text-primary"
          }`}
        >
          {scope.text}
        </span>
      </div>
      <div className={`p-1.5 rounded-lg shrink-0 ${TONES[tone]}`}>{icon}</div>
    </div>
  );
}

/** A type membership with a share bar. The share is of the customer count, not of each other. */
function TypeRow({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-semibold text-foreground w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-bold font-mono text-foreground w-8 text-right shrink-0">{count}</span>
    </div>
  );
}

function AttentionRow({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={`text-[11px] font-bold font-mono ${
          count > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-bold font-mono text-foreground">{value}</span>
    </div>
  );
}
