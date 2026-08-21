"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { formatPrice } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/datetime";
import { FileText, Paperclip, MessageCircleQuestion } from "lucide-react";
import type { AdvanceBalanceStatementPage, AdvanceBalanceTransactionView } from "@/types/advanceBalance";

interface AdvanceBalancePassbookProps {
  data: AdvanceBalanceStatementPage | null;
  isLoading?: boolean;
  error?: string | null;
  onPageChange?: (page: number) => void;
  onRaiseQuery?: (transactionId: string, label: string) => void;
  onViewReceipt?: (transaction: AdvanceBalanceTransactionView) => void;
  /** Staff see who acted plus internal columns; customers see the name only. */
  showStatus?: boolean;
  filters?: React.ReactNode;
  title?: string;
  /** Drops the Card chrome when nested inside an accordion, which already supplies it. */
  bare?: boolean;
}

/**
 * The passbook.
 *
 * Stays a table at every width and scrolls sideways on small screens. Two details make
 * that survivable rather than annoying: the scroll is confined to its own container so the
 * page body never moves, and the date column is frozen so a swipe never loses your place
 * in a ledger.
 */
export function AdvanceBalancePassbook({
  data,
  isLoading,
  error,
  onPageChange,
  onRaiseQuery,
  onViewReceipt,
  showStatus = false,
  filters,
  title = "Passbook",
  bare = false,
}: AdvanceBalancePassbookProps) {
  const rows = data?.transactions ?? [];

  /**
   * Both advanceBalances listed together.
   *
   * Two things follow: each row needs a badge saying which Advance Balance it came from, and the
   * Balance column has to go — `balanceAfter` is a per-wallet running total, so interleaving
   * two advanceBalances by date makes it jump between unrelated figures.
   */
  const isCombined = data?.combined ?? false;

  // Nested in an accordion the outer chrome already exists; a second card with its own
  // heading would repeat the section title back at the reader.
  const Shell = bare ? React.Fragment : Card;
  const shellProps = bare ? {} : { className: "border border-border" };
  const Body = bare ? "div" : CardContent;

  return (
    <Shell {...shellProps}>
      {bare ? (
        (data?.from || filters) && (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {data?.from && data?.to ? (
              <p className="text-[11px] text-muted-foreground">
                {formatDateTimeIST(data.from)} — {formatDateTimeIST(data.to)}
              </p>
            ) : (
              <span />
            )}
            {filters}
          </div>
        )
      ) : (
        <CardHeader className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              {title}
            </CardTitle>
            {data?.from && data?.to && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {formatDateTimeIST(data.from)} — {formatDateTimeIST(data.to)}
              </p>
            )}
          </div>
          {filters}
        </CardHeader>
      )}

      <Body className={bare ? "overflow-hidden rounded-lg border" : "p-0"}>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="p-8 text-center text-xs text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Money added to and spent from this Advance Balance will appear here."
          />
        ) : (
          <>
            {/* The scroll lives here, not on the page. A body that scrolls sideways is the
                failure mode that makes an app feel broken. */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <caption className="sr-only">
                  Advance Balance transactions{data?.from ? ` from ${data.from} to ${data.to}` : ""}, showing
                  date, description, category, credit, debit and running balance.
                </caption>
                <thead>
                  <tr className="border-b bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-secondary/30 px-4 py-2.5 font-bold backdrop-blur-sm"
                    >
                      Date
                    </th>
                    <th scope="col" className="px-4 py-2.5 font-bold">Particulars</th>
                    <th scope="col" className="px-4 py-2.5 font-bold">Category</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-bold">Credit</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-bold">Debit</th>
                    {/* Dropped when both advanceBalances are listed — see isCombined. */}
                    {!isCombined && (
                      <th scope="col" className="px-4 py-2.5 text-right font-bold">Balance</th>
                    )}
                    <th scope="col" className="px-4 py-2.5 font-bold">Recorded by</th>
                    <th scope="col" className="px-4 py-2.5 font-bold">
                      <span className="sr-only">Documents</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row) => {
                    const isCredit = row.direction === "credit";
                    const isReversed = row.status === "reversed";

                    return (
                      <tr
                        key={row._id}
                        className="border-b text-xs transition-colors last:border-0 hover:bg-secondary/20"
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-3 text-left font-medium text-muted-foreground"
                        >
                          {formatDateTimeIST(row.createdAt)}
                        </th>

                        <td className="px-4 py-3">
                          {/*
                            Which Advance Balance this row belongs to, shown only when both are listed
                            together — otherwise the section heading already says it, and a
                            badge on every row would be noise.
                          */}
                          {isCombined && (
                            <span
                              className={`mr-2 inline-block rounded px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider ${
                                row.walletType === "business"
                                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  : "bg-primary/10 text-primary"
                              }`}
                            >
                              {row.walletType === "business" ? "Business" : "Store"}
                            </span>
                          )}
                          <span
                            className={`font-semibold text-foreground ${isReversed ? "line-through opacity-60" : ""}`}
                          >
                            {row.transactionName}
                          </span>
                          {row.description && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">
                              {row.description}
                            </span>
                          )}
                          {row.orderId && (
                            <Link
                              href={`/client/orders/${row.orderId}`}
                              className="mt-0.5 block text-[11px] font-medium text-primary hover:underline"
                            >
                              {row.orderId}
                            </Link>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {row.categoryLabel ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: row.categoryColour || "var(--muted-foreground)" }}
                                aria-hidden="true"
                              />
                              {row.categoryLabel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        {/*
                          Credits are emerald; debits are plain foreground, not red. A
                          statement where every ordinary expense is red reads as an error
                          log. Red is kept for things that actually went wrong.
                        */}
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-primary">
                          {isCredit ? formatPrice(row.amount) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-foreground">
                          {/* U+2212 minus, not a hyphen — a hyphen reads as a dash at this size. */}
                          {!isCredit ? `−${formatPrice(row.amount)}` : "—"}
                        </td>
                        {!isCombined && (
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-muted-foreground">
                            {formatPrice(row.balanceAfter)}
                          </td>
                        )}

                        <td className="whitespace-nowrap px-4 py-3">
                          {row.actedByRole === "Customer" || !row.actedBy ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="font-medium text-foreground">{row.actedBy}</span>
                          )}
                          {showStatus && row.status !== "success" && (
                            <Badge
                              variant={row.status === "failed" ? "destructive" : "warning"}
                              className="ml-1.5 text-[9px] uppercase"
                            >
                              {row.status}
                            </Badge>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {row.proofUrl && (
                              <a
                                href={row.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-primary"
                                // Context in the label, so a screen reader user knows which
                                // row's bill this is without navigating back to the date.
                                aria-label={`Open bill for ${row.transactionName}, ${formatDateTimeIST(row.createdAt)}`}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {onViewReceipt && (
                              <button
                                type="button"
                                onClick={() => onViewReceipt(row)}
                                className="text-muted-foreground hover:text-primary"
                                aria-label={`View receipt for ${row.transactionName}`}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {onRaiseQuery && row.actedByRole !== "Customer" && !isCredit && (
                              <button
                                type="button"
                                onClick={() => onRaiseQuery(row._id, row.transactionName)}
                                className="cursor-pointer text-muted-foreground hover:text-primary"
                                aria-label={`Raise a query about ${row.transactionName}, ${formatPrice(row.amount)}`}
                              >
                                <MessageCircleQuestion className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals in a tfoot so the statement reconciles without reading every row. */}
                {data && (
                  <tfoot>
                    <tr className="border-t-2 bg-secondary/20 text-xs font-bold">
                      <th scope="row" className="sticky left-0 z-10 bg-secondary/20 px-4 py-3 text-left">
                        Totals
                      </th>
                      {/*
                        Opening and closing are per-wallet figures. Viewing both advanceBalances at
                        once there is no single running position to state, so the server sends
                        null and the cell says so rather than printing a number that looks
                        authoritative and means nothing.
                      */}
                      <td className="px-4 py-3 text-muted-foreground" colSpan={2}>
                        {data.openingBalance === null
                          ? "Both wallets"
                          : `Opening ${formatPrice(data.openingBalance)}`}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-primary">
                        {formatPrice(data.totalCredits)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        −{formatPrice(data.totalDebits)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {data.closingBalance === null ? "—" : formatPrice(data.closingBalance)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {data && data.totalPages > 1 && onPageChange && (
              <div className="border-t p-3">
                <Pagination
                  currentPage={data.page}
                  totalPages={data.totalPages}
                  onPageChange={onPageChange}
                  totalItems={data.totalCount}
                  itemsPerPage={data.pageSize}
                />
              </div>
            )}
          </>
        )}
      </Body>
    </Shell>
  );
}
