"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Accordion } from "@/components/ui/Accordion";
import { Card, CardContent } from "@/components/ui/Card";
import { useToastStore } from "@/stores/toastStore";
import { AdvanceBalanceCard } from "@/components/advance-balance/AdvanceBalanceCard";
import { AdvanceBalanceBreakdown } from "@/components/advance-balance/AdvanceBalanceBreakdown";
import { AdvanceBalancePassbook } from "@/components/advance-balance/AdvanceBalancePassbook";
import { AddMoneyDialog } from "@/components/advance-balance/AddMoneyDialog";
import { AdvanceBalanceReceiptDialog } from "@/components/advance-balance/AdvanceBalanceReceiptDialog";
import { TransferFundsDialog } from "@/components/advance-balance/TransferFundsDialog";
import * as advanceBalanceService from "@/services/advanceBalanceService";
import { ADVANCE_BALANCE_TERMS_TEXT, RECHARGE_UNAVAILABLE_MESSAGE } from "@/lib/advanceBalanceConstants";

import { DateRangePicker } from "@/components/advance-balance/DateRangePicker";
import { resolveRange, describeRange, formatRangePeriod, type DateRange } from "@/lib/dateRange";
import { formatPrice } from "@/lib/utils";
import { Plus, ShieldAlert, Info, Wallet as AdvanceBalanceIcon, PieChart, FileText, Download, ArrowRight } from "lucide-react";
import type { AdvanceBalanceSummary, AdvanceBalanceBreakdown as BreakdownData, AdvanceBalanceStatementPage, AdvanceBalanceType, AdvanceBalanceScope, AdvanceBalanceTransactionView } from "@/types/advanceBalance";
import { useAuthStore } from "@/stores/authStore";
import { downloadStatementPdf } from "@/lib/pdfHelper";

/**
 * The customer's Advance Balance screen.
 *
 * Organised as disclosure sections matching the staff Advance Balance panel so that the admin and customer
 * views remain identical in structure and data representation.
 */
export const dynamic = "force-dynamic";

/**
 * Shown in place of the Add Money button when online top-up is switched off.
 */
function RechargeUnavailableNotice({ reason }: { reason?: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {RECHARGE_UNAVAILABLE_MESSAGE[reason || "disabled_by_admin"]}
    </p>
  );
}

export default function ClientAdvanceBalancePage() {
  const { addToast } = useToastStore();
  const auth = useAuthStore();

  const [summary, setSummary] = React.useState<AdvanceBalanceSummary | null>(null);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(true);

  const [breakdownTab, setBreakdownTab] = React.useState<AdvanceBalanceScope>("all");
  const [passbookTab, setPassbookTab] = React.useState<AdvanceBalanceScope>("all");
  const [range, setRange] = React.useState<DateRange>(() => resolveRange("this_fy"));

  const [breakdown, setBreakdown] = React.useState<BreakdownData | null>(null);
  const [breakdownError, setBreakdownError] = React.useState<string | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = React.useState(true);

  const [passbook, setPassbook] = React.useState<AdvanceBalanceStatementPage | null>(null);
  const [passbookError, setPassbookError] = React.useState<string | null>(null);
  const [isLoadingPassbook, setIsLoadingPassbook] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [categoryFilter, setCategoryFilter] = React.useState<string | undefined>();

  const [addMoneyFor, setAddMoneyFor] = React.useState<AdvanceBalanceType | null>(null);
  const [viewingReceipt, setViewingReceipt] = React.useState<AdvanceBalanceTransactionView | null>(null);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  // Manage accordions independently so all can be open at once (matching StaffAdvanceBalancePanel)
  const [openAccordions, setOpenAccordions] = React.useState<Record<string, boolean>>({
    "wallets": true,
    "wallet-breakdown": true,
    "wallet-history": true,
  });

  const toggleAccordion = (id: string, isOpen: boolean) => {
    setOpenAccordions((prev) => ({ ...prev, [id]: isOpen }));
  };

  const loadSummary = React.useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      setSummary(await advanceBalanceService.getAdvanceBalances());
    } catch (err) {
      setSummaryError((err as Error).message || "Could not load your wallets");
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  const loadBreakdown = React.useCallback(async () => {
    const dates = { from: range.from, to: range.to };
    setIsLoadingBreakdown(true);
    setBreakdownError(null);
    try {
      const data = await advanceBalanceService.getBreakdown({ walletType: breakdownTab, ...dates });
      setBreakdown(data);
    } catch (err) {
      setBreakdownError((err as Error).message || "Could not load the breakdown");
    } finally {
      setIsLoadingBreakdown(false);
    }
  }, [breakdownTab, range]);

  const loadPassbook = React.useCallback(async () => {
    const dates = { from: range.from, to: range.to };
    setIsLoadingPassbook(true);
    setPassbookError(null);
    try {
      const data = await advanceBalanceService.getTransactions({
        walletType: passbookTab,
        page,
        category: categoryFilter,
        ...dates,
      });
      setPassbook(data);
    } catch (err) {
      setPassbookError((err as Error).message || "Could not load transactions");
    } finally {
      setIsLoadingPassbook(false);
    }
  }, [passbookTab, range, page, categoryFilter]);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  React.useEffect(() => {
    void loadBreakdown();
  }, [loadBreakdown]);

  React.useEffect(() => {
    void loadPassbook();
  }, [loadPassbook]);

  // Period or tab changes reset paging
  React.useEffect(() => {
    setPage(1);
  }, [range, passbookTab, categoryFilter]);

  const refreshAll = React.useCallback(() => {
    void loadSummary();
    void loadBreakdown();
    void loadPassbook();
  }, [loadSummary, loadBreakdown, loadPassbook]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const dates = { from: range.from, to: range.to };
      const fullPage = await advanceBalanceService.getTransactions({ walletType: passbookTab, limit: 1000, ...dates });
      if (fullPage && fullPage.transactions.length > 0) {
        // The downloaded statement names its own scope — "Store Advance Balance" on a combined export
        // would misdescribe what is inside it.
        const label =
          passbookTab === "all"
            ? "All advanceBalances (Store & Business)"
            : passbookTab === "business"
              ? "Business Advance Balance"
              : "Store Advance Balance";
        await downloadStatementPdf(fullPage.transactions, auth.customer?.name || "Customer", label, formatRangePeriod(range));
        addToast("Statement PDF downloaded successfully", "success");
      } else {
        addToast("No transactions found for the selected period", "info");
      }
    } catch (err) {
      addToast("Failed to generate PDF", "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleTransferConfirm = async (amount: number, password?: string) => {
    await advanceBalanceService.transferToBusinessAdvanceBalance({
      userId: auth.customer?._id || "",
      amount,
      adminPassword: password,
    });
    addToast(`${formatPrice(amount)} moved to your Business Advance Balance.`, "success");
    setTransferOpen(false);
    refreshAll();
  };

  const businessBlocked = Boolean(summary?.businessEligible && !summary?.kycApproved);
  const onlineRechargeOff = Boolean(summary && !summary.onlineRechargeAvailable);
  /**
   * All · Business · Store.
   *
   * `all` leads because it answers the question the panel is titled with — a customer wants
   * their whole position first and the per-wallet split second. Offered only when they
   * actually hold two advanceBalances; with one, "All" and "Store" would be the same view twice.
   */
  const tabs: AdvanceBalanceScope[] = summary?.businessEligible ? ["all", "business", "store"] : ["store"];

  /** Tab captions, kept beside the list so the two cannot drift apart. */
  const tabLabel = (tab: AdvanceBalanceScope) =>
    tab === "all" ? "All" : tab === "business" ? "Business" : "Store";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-foreground">My Advance Balance</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Prepaid balance for your orders and business services.
        </p>
      </header>

      {summaryError ? (
        <Card className="border border-destructive/30 bg-destructive/5">
          <CardContent className="p-6 text-center">
            <p className="text-sm font-semibold text-destructive">{summaryError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refreshAll}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : isLoadingSummary ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-52 w-full rounded-xl" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <Accordion
            id="wallets"
            title="Wallets"
            icon={<AdvanceBalanceIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
            isOpen={openAccordions["wallets"]}
            onToggle={(isOpen) => toggleAccordion("wallets", isOpen)}
          >
            <p className="mb-4 text-sm text-muted-foreground">
              Prepaid balance held for your account. Every entry here is recorded in real-time.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {summary?.businessEligible && (
                <AdvanceBalanceCard
                  type="business"
                  advanceBalance={summary?.business ?? null}
                  customerName={auth.customer?.name}
                  notice={
                    businessBlocked ? (
                      <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                        <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                          Your KYC is pending, so services cannot begin yet.{" "}
                          <Link href="/client/upgrade" className="font-bold underline">
                            Complete your KYC
                          </Link>{" "}
                          to start using this balance.
                        </p>
                      </div>
                    ) : null
                  }
                  actions={
                    onlineRechargeOff ? (
                      <RechargeUnavailableNotice reason={summary?.onlineRechargeReason} />
                    ) : (
                      <Button size="sm" onClick={() => setAddMoneyFor("business")} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Add Money
                      </Button>
                    )
                  }
                />
              )}
              <AdvanceBalanceCard
                type="store"
                advanceBalance={summary?.store ?? null}
                customerName={auth.customer?.name}
                actions={
                  onlineRechargeOff ? (
                    <RechargeUnavailableNotice reason={summary?.onlineRechargeReason} />
                  ) : (
                    <Button size="sm" onClick={() => setAddMoneyFor("store")} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Add Money
                    </Button>
                  )
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!onlineRechargeOff && (
                <Button size="sm" onClick={() => setAddMoneyFor("store")} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Money
                </Button>
              )}
              {summary?.businessEligible && (summary?.store?.availableBalance ?? 0) > 0 && (
                <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} className="gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" /> Move to Business
                </Button>
              )}
            </div>
          </Accordion>
        </>
      )}

      <Accordion
        id="wallet-breakdown"
        title="Where your money went"
        icon={<PieChart className="h-4 w-4 text-primary" aria-hidden="true" />}
        summary={
          breakdown ? (
            <span className="text-xs font-semibold text-muted-foreground">
              <span className="tabular-nums">{formatPrice(breakdown.totalSpent)}</span>
              {" spent · "}
              {describeRange(range)}
            </span>
          ) : null
        }
        isOpen={openAccordions["wallet-breakdown"]}
        onToggle={(isOpen) => toggleAccordion("wallet-breakdown", isOpen)}
      >
        <AdvanceBalanceBreakdown
          data={breakdown}
          isLoading={isLoadingBreakdown}
          error={breakdownError}
          bare
          onSelectCategory={(key) => setCategoryFilter((prev) => (prev === key ? undefined : key))}
          rangeControl={
            <div className="flex flex-wrap items-center gap-2">
              {summary?.businessEligible && (
                <div className="inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
                  {tabs.map((tab) => {
                    const isSelected = breakdownTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setBreakdownTab(tab)}
                        className={`cursor-pointer rounded-[4px] px-2.5 py-1 text-[10px] font-bold transition-all ${
                          isSelected ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tabLabel(tab)}
                      </button>
                    );
                  })}
                </div>
              )}
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          }
        />
      </Accordion>

      <Accordion
        id="wallet-history"
        title="Advance Balance passbook"
        icon={<FileText className="h-4 w-4 text-primary" aria-hidden="true" />}
        summary={
          passbook ? (
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {passbook.totalCount} {passbook.totalCount === 1 ? "entry" : "entries"}
            </span>
          ) : null
        }
        isOpen={openAccordions["wallet-history"]}
        onToggle={(isOpen) => toggleAccordion("wallet-history", isOpen)}
      >
        <AdvanceBalancePassbook
          data={passbook}
          isLoading={isLoadingPassbook}
          error={passbookError}
          onPageChange={setPage}
          bare
          onViewReceipt={setViewingReceipt}
          onRaiseQuery={(_id, label) =>
            addToast(`We have logged your query about "${label}". Our team will get back to you.`, "success")
          }
          filters={
            <div className="flex flex-wrap items-center justify-end gap-2">
              {summary?.businessEligible && (
                <div className="inline-flex rounded-md border border-border bg-secondary/30 p-0.5">
                  {tabs.map((tab) => {
                    const isSelected = passbookTab === tab;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setPassbookTab(tab);
                          setPage(1);
                        }}
                        className={`cursor-pointer rounded-[4px] px-2.5 py-1 text-[10px] font-bold transition-all ${
                          isSelected ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {tabLabel(tab)}
                      </button>
                    );
                  })}
                </div>
              )}
              {categoryFilter && (
                <Button variant="outline" size="sm" onClick={() => setCategoryFilter(undefined)}>
                  Clear category filter
                </Button>
              )}
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {isDownloadingPdf ? "Generating..." : "Download PDF"}
              </button>
              <a
                suppressHydrationWarning
                href={advanceBalanceService.statementUrl({ walletType: passbookTab, from: range.from, to: range.to })}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                Download CSV
              </a>
            </div>
          }
        />
      </Accordion>

      <p className="flex items-start gap-2 rounded-lg bg-secondary/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {ADVANCE_BALANCE_TERMS_TEXT}
      </p>

      {addMoneyFor && (
        <AddMoneyDialog
          walletType={addMoneyFor}
          kycApproved={summary?.kycApproved ?? false}
          onClose={() => setAddMoneyFor(null)}
          onCredited={() => {
            setAddMoneyFor(null);
            refreshAll();
          }}
        />
      )}

      <AdvanceBalanceReceiptDialog
        open={!!viewingReceipt}
        onOpenChange={(open) => {
          if (!open) setViewingReceipt(null);
        }}
        transaction={viewingReceipt}
        customerName={auth.customer?.name || "Customer"}
        customerEmail={auth.customer?.email}
      />

      {summary?.store && (
        <TransferFundsDialog
          customerName={auth.customer?.name || "Customer"}
          availableBalance={summary.store.availableBalance}
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}

