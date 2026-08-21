"use client";

import * as React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPrice } from "@/lib/utils";
import { PieChart as PieIcon } from "lucide-react";
import type { AdvanceBalanceBreakdown as BreakdownData } from "@/types/advanceBalance";

interface AdvanceBalanceBreakdownProps {
  data: BreakdownData | null;
  isLoading?: boolean;
  error?: string | null;
  onSelectCategory?: (categoryKey: string) => void;
  /** Range presets rendered in the header — the caller owns the date state. */
  rangeControl?: React.ReactNode;
  title?: string;
  /** Drops the Card chrome when nested inside an accordion, which already supplies it. */
  bare?: boolean;
}

/**
 * "Where your money went" — a donut with the numbers beside it.
 *
 * The **list is the source of truth and the donut is decoration**: every figure is readable
 * without the chart, so screen readers, printed statements and a failed chart render all
 * still answer the question. That ordering also decides the mobile layout — the list never
 * shrinks to make room for the circle.
 */
export function AdvanceBalanceBreakdown({
  data,
  isLoading,
  error,
  onSelectCategory,
  rangeControl,
  title = "Where your money went",
  bare = false,
}: AdvanceBalanceBreakdownProps) {
  const slices = data?.slices ?? [];
  const hasSpend = slices.length > 0 && (data?.totalSpent ?? 0) > 0;

  // Nested in an accordion the outer chrome is already there, so a second bordered card
  // with its own heading would repeat the section title back at the reader.
  const Shell = bare ? React.Fragment : Card;
  const shellProps = bare ? {} : { className: "border border-border" };
  const Body = bare ? "div" : CardContent;

  return (
    <Shell {...shellProps}>
      {bare ? (
        rangeControl && <div className="mb-3 flex justify-end">{rangeControl}</div>
      ) : (
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b p-4">
          <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
            <PieIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            {title}
          </CardTitle>
          {rangeControl}
        </CardHeader>
      )}

      <Body className={bare ? "" : "p-4"}>
        {isLoading ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Skeleton className="mx-auto h-40 w-40 rounded-full" />
            <div className="flex-1 space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          /* Never render an error as ₹0 — a customer must be able to tell a failed load
             from a Advance Balance that has genuinely spent nothing. */
          <p className="py-8 text-center text-xs text-destructive">{error}</p>
        ) : !hasSpend ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No spending recorded for this period yet.
          </p>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Stacked on mobile, side by side above it. Shrinking a donut to sit beside a
                list on a phone makes both unreadable. */}
            <div className="relative mx-auto h-44 w-44 shrink-0" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="total"
                    nameKey="label"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={2}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {slices.map((slice) => (
                      <Cell
                        key={slice.categoryKey}
                        fill={slice.colour}
                        className={onSelectCategory ? "cursor-pointer" : undefined}
                        onClick={
                          onSelectCategory ? () => onSelectCategory(slice.categoryKey) : undefined
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [formatPrice(Number(value) || 0), String(name)]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: "11px",
                      color: "var(--card-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {formatPrice(data?.totalSpent ?? 0)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  spent
                </span>
              </div>
            </div>

            <ul className="flex-1 space-y-1.5">
              {slices.map((slice) => {
                const Row = onSelectCategory && slice.categoryKey !== "__other__" ? "button" : "div";
                return (
                  <li key={slice.categoryKey}>
                    <Row
                      {...(Row === "button"
                        ? {
                            type: "button" as const,
                            onClick: () => onSelectCategory?.(slice.categoryKey),
                            "aria-label": `View ${slice.label} transactions, ${formatPrice(slice.total)}`,
                          }
                        : {})}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${
                        Row === "button" ? "cursor-pointer hover:bg-secondary/40 transition-colors" : ""
                      }`}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.colour }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {slice.label}
                      </span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-foreground">
                        {formatPrice(slice.total)}
                      </span>
                      <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                        {slice.percent}%
                      </span>
                    </Row>
                  </li>
                );
              })}

              <li className="flex items-center gap-2.5 border-t px-2 pt-2 text-xs font-bold">
                <span className="flex-1">Total</span>
                <span className="tabular-nums">{formatPrice(data?.totalSpent ?? 0)}</span>
                <span className="w-10" />
              </li>
            </ul>
          </div>
        )}
      </Body>
    </Shell>
  );
}
