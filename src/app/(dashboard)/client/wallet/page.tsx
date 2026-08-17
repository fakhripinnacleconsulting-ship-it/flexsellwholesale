"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Accordion } from "@/components/ui/Accordion";
import { useToastStore } from "@/stores/toastStore";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { WalletBreakdown } from "@/components/wallet/WalletBreakdown";
import { WalletPassbook } from "@/components/wallet/WalletPassbook";
import { AddMoneyDialog } from "@/components/wallet/AddMoneyDialog";
import { WalletReceiptDialog } from "@/components/wallet/WalletReceiptDialog";
import * as walletService from "@/services/walletService";
import { WALLET_TERMS_TEXT, RECHARGE_UNAVAILABLE_MESSAGE } from "@/lib/walletConstants";

import { DateRangePicker } from "@/components/wallet/DateRangePicker";
import { resolveRange, describeRange, type DateRange } from "@/lib/dateRange";
import { formatPrice } from "@/lib/utils";
import { Plus, ShieldAlert, Info, Wallet as WalletIcon, Briefcase, PieChart, FileText, Download } from "lucide-react";
import type { WalletSummary, WalletBreakdown as BreakdownData, WalletStatementPage, WalletType, WalletTransactionView } from "@/types/wallet";
import { useAuthStore } from "@/stores/authStore";
import { downloadStatementPdf } from "@/lib/pdfHelper";

/**
 * The customer's wallet screen.
 *
 * Organised as disclosure sections rather than one long scroll: a customer usually arrives
 * to check one thing — a balance, or one charge — and the accordion lets the answer sit at
 * the top without the rest of the page pushing it away.
 *
 * Balances must never come from a cache; the page is client-rendered against a `no-store`
 * API rather than prerendered.
 */
export const dynamic = "force-dynamic";


/**
 * Shown in place of the Add Money button when online top-up is switched off.
 *
 * Occupies the same slot as the button rather than silently disappearing: a customer who used
 * this last week needs to know the option was withdrawn and what to do instead, not wonder
 * whether the page is broken.
 */
function RechargeUnavailableNotice({ reason }: { reason?: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {RECHARGE_UNAVAILABLE_MESSAGE[reason || "disabled_by_admin"]}
    </p>
  );
}

export default function ClientWalletPage() {
  const { addToast } = useToastStore();

  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = React.useState(true);

  const [activeTab, setActiveTab] = React.useState<WalletType>("store");
  // One range drives the breakdown, the passbook and the export, so the three can never
  // disagree about the period the customer is looking at.
  const [range, setRange] = React.useState<DateRange>(() => resolveRange("this_fy"));

  const [breakdown, setBreakdown] = React.useState<BreakdownData | null>(null);
  const [breakdownError, setBreakdownError] = React.useState<string | null>(null);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = React.useState(true);

  const [passbook, setPassbook] = React.useState<WalletStatementPage | null>(null);
  const [passbookError, setPassbookError] = React.useState<string | null>(null);
  const [isLoadingPassbook, setIsLoadingPassbook] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [categoryFilter, setCategoryFilter] = React.useState<string | undefined>();

  const [addMoneyFor, setAddMoneyFor] = React.useState<WalletType | null>(null);
  const [viewingReceipt, setViewingReceipt] = React.useState<WalletTransactionView | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const auth = useAuthStore();

  // Manage accordion mutual exclusivity
  const [openAccordion, setOpenAccordion] = React.useState<string | null>("store-wallet");

  // When summary loads and business is blocked, switch the active accordion to grab attention
  React.useEffect(() => {
    if (summary?.businessEligible && !summary?.kycApproved) {
      setOpenAccordion("business-wallet");
    }
  }, [summary?.businessEligible, summary?.kycApproved]);



  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const dates = { from: range.from, to: range.to };
      const fullPage = await walletService.getTransactions({ walletType: activeTab, limit: 1000, ...dates });
      if (fullPage && fullPage.transactions.length > 0) {
        const label = activeTab === "business" ? "Business Wallet" : "Store Wallet";
        await downloadStatementPdf(fullPage.transactions, auth.customer?.name || "Customer", label, describeRange(range));
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

  const loadSummary = React.useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      setSummary(await walletService.getWallets());
    } catch (err) {
      // Deliberately not falling back to an empty summary: a failed fetch rendered as ₹0
      // would tell a customer their money is gone.
      setSummaryError((err as Error).message || "Could not load your wallets");
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  React.useEffect(() => {
    let cancelled = false;
    const dates = { from: range.from, to: range.to };

    setIsLoadingBreakdown(true);
    setBreakdownError(null);
    walletService
      .getBreakdown({ walletType: activeTab, ...dates })
      .then((data) => !cancelled && setBreakdown(data))
      .catch((err) => !cancelled && setBreakdownError((err as Error).message || "Could not load the breakdown"))
      .finally(() => !cancelled && setIsLoadingBreakdown(false));

    return () => {
      cancelled = true;
    };
  }, [activeTab, range]);

  React.useEffect(() => {
    let cancelled = false;
    const dates = { from: range.from, to: range.to };

    setIsLoadingPassbook(true);
    setPassbookError(null);
    walletService
      .getTransactions({ walletType: activeTab, page, category: categoryFilter, ...dates })
      .then((data) => !cancelled && setPassbook(data))
      .catch((err) => !cancelled && setPassbookError((err as Error).message || "Could not load transactions"))
      .finally(() => !cancelled && setIsLoadingPassbook(false));

    return () => {
      cancelled = true;
    };
  }, [activeTab, range, page, categoryFilter]);

  // Filters and pagination are independent axes; changing one must reset the other or the
  // customer lands on page 4 of a two-page result and sees nothing.
  React.useEffect(() => {
    setPage(1);
  }, [activeTab, range, categoryFilter]);

  const businessBlocked = Boolean(summary?.businessEligible && !summary?.kycApproved);
  // The server refuses the route regardless; this only decides what the customer is offered.
  const onlineRechargeOff = Boolean(summary && !summary.onlineRechargeAvailable);

  const balanceSummary = (type: WalletType) => {
    const w = type === "store" ? summary?.store : summary?.business;
    return (
      <span className="text-sm font-bold tabular-nums text-foreground">
        {formatPrice(w?.availableBalance ?? 0)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-foreground">My Wallets</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Prepaid balance for your orders and business services.
        </p>
      </header>

      {summaryError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-center">
          <p className="text-sm font-semibold text-destructive">{summaryError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadSummary()}>
            Try again
          </Button>
        </div>
      ) : isLoadingSummary ? (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Store Wallet opens by default — it is the one every customer has. */}
          <Accordion
            id="store-wallet"
            title="Store Wallet"
            icon={<WalletIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
            summary={balanceSummary("store")}
            isOpen={openAccordion === "store-wallet"}
            onToggle={(isOpen) => setOpenAccordion(isOpen ? "store-wallet" : null)}
          >
            <WalletBalanceCard
              type="store"
              wallet={summary?.store ?? null}
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
          </Accordion>

          {summary?.businessEligible && (
            <Accordion
              id="business-wallet"
              title="Business Wallet"
              icon={<Briefcase className="h-4 w-4 text-primary" aria-hidden="true" />}
              summary={balanceSummary("business")}
              isOpen={openAccordion === "business-wallet"}
              onToggle={(isOpen) => setOpenAccordion(isOpen ? "business-wallet" : null)}
            >
              <WalletBalanceCard
                type="business"
                wallet={summary?.business ?? null}
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
            </Accordion>
          )}
        </>
      )}

      {/* One wallet selector for the two sections below, so they never disagree about
          which wallet is being examined. */}
      {summary?.businessEligible && (
        <div
          role="tablist"
          aria-label="Choose which wallet to examine"
          className="inline-flex rounded-lg border border-border bg-secondary/30 p-1 backdrop-blur-sm"
        >
          {(["store", "business"] as const).map((tab) => {
            const isSelected = activeTab === tab;
            const Icon = tab === "store" ? WalletIcon : Briefcase;
            return (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={isSelected}
                onClick={() => setActiveTab(tab)}
                className={`relative flex cursor-pointer items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-200 ease-out active:scale-95 ${
                  isSelected
                    ? "bg-card text-primary shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground/70"}`} aria-hidden="true" />
                {tab === "store" ? "Store Wallet" : "Business Wallet"}
              </button>
            );
          })}
        </div>
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
        isOpen={openAccordion === "wallet-breakdown"}
        onToggle={(isOpen) => setOpenAccordion(isOpen ? "wallet-breakdown" : null)}
      >
        <WalletBreakdown
          data={breakdown}
          isLoading={isLoadingBreakdown}
          error={breakdownError}
          bare
          onSelectCategory={(key) => setCategoryFilter((prev) => (prev === key ? undefined : key))}
          rangeControl={<DateRangePicker value={range} onChange={setRange} />}
        />
      </Accordion>

      <Accordion
        id="wallet-history"
        title="Transaction history"
        icon={<FileText className="h-4 w-4 text-primary" aria-hidden="true" />}
        summary={
          passbook ? (
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">
              {passbook.totalCount} {passbook.totalCount === 1 ? "entry" : "entries"}
            </span>
          ) : null
        }
        isOpen={openAccordion === "wallet-history"}
        onToggle={(isOpen) => setOpenAccordion(isOpen ? "wallet-history" : null)}
      >
        <WalletPassbook
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
            <div className="flex flex-wrap items-center gap-2">
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
              {/*
                A plain link, not a fetch-then-blob. The browser's own download handling
                gives a progress indicator and a file in the downloads folder — a scripted
                save would reimplement both, worse.
              */}
              <a
                suppressHydrationWarning
                href={walletService.statementUrl({ walletType: activeTab, from: range.from, to: range.to })}
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
        {WALLET_TERMS_TEXT}
      </p>

      {addMoneyFor && (
        <AddMoneyDialog
          walletType={addMoneyFor}
          kycApproved={summary?.kycApproved ?? false}
          onClose={() => setAddMoneyFor(null)}
          onCredited={() => {
            setAddMoneyFor(null);
            void loadSummary();
            setPage(1);
          }}
        />
      )}

      <WalletReceiptDialog
        open={!!viewingReceipt}
        onOpenChange={(open) => {
          if (!open) setViewingReceipt(null);
        }}
        transaction={viewingReceipt}
        customerName={auth.customer?.name || "Customer"}
        customerEmail={auth.customer?.email}
      />
    </div>
  );
}
