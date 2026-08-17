"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Accordion } from "@/components/ui/Accordion";
import { useToastStore } from "@/stores/toastStore";
import { WalletBalanceCard } from "@/components/wallet/WalletBalanceCard";
import { WalletBreakdown } from "@/components/wallet/WalletBreakdown";
import { WalletPassbook } from "@/components/wallet/WalletPassbook";
import { RecordExpenseDialog } from "@/components/wallet/RecordExpenseDialog";
import { AddFundsOfflineDialog } from "@/components/wallet/AddFundsOfflineDialog";
import { WalletReceiptDialog } from "@/components/wallet/WalletReceiptDialog";
import { TransferFundsDialog } from "@/components/wallet/TransferFundsDialog";
import { FreezeWalletDialog } from "@/components/wallet/FreezeWalletDialog";
import * as walletService from "@/services/walletService";
import { usePermissions } from "@/hooks/usePermissions";
import { formatPrice } from "@/lib/utils";
import { DateRangePicker } from "@/components/wallet/DateRangePicker";
import { resolveRange, describeRange, type DateRange } from "@/lib/dateRange";
import { Receipt, Banknote, Wallet as WalletIcon, ArrowRight, Lock, Unlock, Download, PieChart, FileText, Briefcase, CreditCard, Info } from "lucide-react";
import { AddMoneyDialog } from "@/components/wallet/AddMoneyDialog";
import { RECHARGE_UNAVAILABLE_STAFF_MESSAGE } from "@/lib/walletConstants";
import type { WalletSummary, WalletBreakdown as BreakdownData, WalletStatementPage, WalletType, WalletTransactionView } from "@/types/wallet";
import { downloadStatementPdf } from "@/lib/pdfHelper";

interface StaffWalletPanelProps {
  userId: string;
  customerName: string;
  /** Admins get the money-creating actions; managers get spend only. */
  isAdmin: boolean;
}

/**
 * The staff view of one customer's wallets.
 *
 * The same balance, breakdown and passbook components the customer sees, so the two views
 * cannot drift apart and a support conversation is about the same numbers on both ends.
 * What differs is the actions — and every one of them is refused server-side as well, since
 * hiding a button is not access control.
 */
export function StaffWalletPanel({ userId, customerName, isAdmin }: StaffWalletPanelProps) {
  const { addToast } = useToastStore();
  const { hasPermission } = usePermissions();

  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [summaryError, setSummaryError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const [breakdownTab, setBreakdownTab] = React.useState<WalletType>("store");
  const [passbookTab, setPassbookTab] = React.useState<WalletType>("store");
  const [breakdown, setBreakdown] = React.useState<BreakdownData | null>(null);
  const [passbook, setPassbook] = React.useState<WalletStatementPage | null>(null);
  const [page, setPage] = React.useState(1);
  const [range, setRange] = React.useState<DateRange>(() => resolveRange("this_fy"));

  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [fundsOpen, setFundsOpen] = React.useState(false);
  const [onlineFundsFor, setOnlineFundsFor] = React.useState<WalletType | null>(null);
  const [viewingReceipt, setViewingReceipt] = React.useState<WalletTransactionView | null>(null);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [freezeActionFor, setFreezeActionFor] = React.useState<{ type: WalletType, isFreezing: boolean } | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  // Manage accordions independently so all can be open at once
  const [openAccordions, setOpenAccordions] = React.useState<Record<string, boolean>>({
    "wallets": true,
    "wallet-breakdown": true,
    "wallet-history": true,
  });

  const toggleAccordion = (id: string, isOpen: boolean) => {
    setOpenAccordions(prev => ({ ...prev, [id]: isOpen }));
  };

  const canSpendStore = isAdmin || hasPermission("wallet_store", "create");
  const canSpendBusiness = summary?.businessEligible && (isAdmin || hasPermission("wallet_business", "create"));
  const canSpend = canSpendStore || canSpendBusiness;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setSummaryError(null);
    try {
      setSummary(await walletService.getWallets(userId));
    } catch (err) {
      setSummaryError((err as Error).message || "Could not load wallets");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadBreakdown = React.useCallback(async () => {
    const dates = { from: range.from, to: range.to };
    const b = await walletService.getBreakdown({ userId, walletType: breakdownTab, ...dates }).catch(() => null);
    setBreakdown(b);
  }, [userId, breakdownTab, range]);

  const loadPassbook = React.useCallback(async () => {
    const dates = { from: range.from, to: range.to };
    const p = await walletService.getTransactions({ userId, walletType: passbookTab, page, ...dates }).catch(() => null);
    setPassbook(p);
  }, [userId, passbookTab, page, range]);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const dates = { from: range.from, to: range.to };
      const fullPage = await walletService.getTransactions({ userId, walletType: passbookTab, limit: 1000, ...dates });
      if (fullPage && fullPage.transactions.length > 0) {
        const label = passbookTab === "business" ? "Business Wallet" : "Store Wallet";
        await downloadStatementPdf(fullPage.transactions, customerName, label, describeRange(range));
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

  // Changing the period must reset paging
  React.useEffect(() => {
    setPage(1);
  }, [range, passbookTab]);

  React.useEffect(() => {
    void loadBreakdown();
  }, [loadBreakdown]);

  React.useEffect(() => {
    void loadPassbook();
  }, [loadPassbook]);

  const refreshAll = () => {
    void load();
    void loadBreakdown();
    void loadPassbook();
  };

  /**
   * Store → Business transfer.
   */
  const handleTransferConfirm = async (amount: number, password?: string) => {
    await walletService.transferToBusinessWallet({ userId, amount, adminPassword: password });
    addToast(`${formatPrice(amount)} moved to the Business Wallet.`, "success");
    setTransferOpen(false);
    refreshAll();
  };

  const handleToggleFreezeConfirm = async (reason: string) => {
    if (!freezeActionFor) return;
    const { type, isFreezing } = freezeActionFor;
    
    await walletService.setWalletStatus({
      userId,
      walletType: type,
      status: isFreezing ? "frozen" : "active",
      reason,
    });
    addToast(isFreezing ? "Wallet frozen." : "Wallet reactivated.", "success");
    setFreezeActionFor(null);
    refreshAll();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-52 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (summaryError) {
    return (
      <Card className="border border-destructive/30 bg-destructive/5">
        <CardContent className="p-6 text-center">
          <p className="text-sm font-semibold text-destructive">{summaryError}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refreshAll}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const tabs: WalletType[] = summary?.businessEligible ? ["business", "store"] : ["store"];

  return (
    <div className="space-y-5">
      <Accordion
        id="wallets"
        title="Wallets"
        icon={<WalletIcon className="h-4 w-4 text-primary" aria-hidden="true" />}
        isOpen={openAccordions["wallets"]}
        onToggle={(isOpen) => toggleAccordion("wallets", isOpen)}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Prepaid balance held for {customerName}. Every entry here is visible to the customer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {summary?.businessEligible && (
            <WalletBalanceCard 
              type="business" 
              wallet={summary?.business ?? null} 
              customerName={customerName}
              actions={
                isAdmin && summary?.business && summary.business.status !== "closed" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFreezeActionFor({ type: "business", isFreezing: summary.business!.status !== "frozen" })}
                    className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                  >
                    {summary.business.status === "frozen" ? (
                      <><Unlock className="h-3.5 w-3.5" /> Unfreeze</>
                    ) : (
                      <><Lock className="h-3.5 w-3.5" /> Freeze</>
                    )}
                  </Button>
                ) : undefined
              }
            />
          )}
          <WalletBalanceCard 
            type="store" 
            wallet={summary?.store ?? null} 
            customerName={customerName}
            actions={
              isAdmin && summary?.store && summary.store.status !== "closed" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFreezeActionFor({ type: "store", isFreezing: summary.store!.status !== "frozen" })}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  {summary.store.status === "frozen" ? (
                    <><Unlock className="h-3.5 w-3.5" /> Unfreeze</>
                  ) : (
                    <><Lock className="h-3.5 w-3.5" /> Freeze</>
                  )}
                </Button>
              ) : undefined
            }
          />
        </div>
      </Accordion>

      <div className="flex flex-wrap items-center justify-start gap-3">

        <div className="flex flex-wrap gap-2">
          {canSpend && (
            <Button size="sm" onClick={() => setExpenseOpen(true)} className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Record Expense
            </Button>
          )}
          {isAdmin && (
            <>
              {/*
                Assisted online payment — the admin opens the checkout and the customer pays on
                it, at a counter or over the phone. Hidden when the admin has switched online
                top-up off, and the route refuses it regardless.
              */}
              {summary?.onlineRechargeAvailable && (
                <Button size="sm" onClick={() => setOnlineFundsFor("store")} className="gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" /> Take Online Payment
                </Button>
              )}

              <Button size="sm" variant="outline" onClick={() => setFundsOpen(true)} className="gap-1.5">
                <Banknote className="h-3.5 w-3.5" /> Add Funds Offline
              </Button>

              {/*
                Told plainly rather than left as an absence. An admin who cannot find the
                online option needs to know they switched it off themselves — otherwise they
                report it as a missing feature.
              */}
              {summary && !summary.onlineRechargeAvailable && (
                <p className="flex w-full items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {RECHARGE_UNAVAILABLE_STAFF_MESSAGE[summary.onlineRechargeReason]}
                    {summary.onlineRechargeReason === "disabled_by_admin" && (
                      <>
                        {" "}
                        <a href="/admin/settings?tab=general" className="font-bold underline">
                          Open Settings
                        </a>
                      </>
                    )}
                  </span>
                </p>
              )}

              {/* One-way only: there is no Business → Store control, because the route has
                  no reverse direction to offer. */}
              {summary?.businessEligible && (summary?.store?.availableBalance ?? 0) > 0 && (
                <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} className="gap-1.5">
                  <ArrowRight className="h-3.5 w-3.5" /> Move to Business
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Accordion
        id="wallet-breakdown"
        title={`Where ${customerName.split(" ")[0]}'s money went`}
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
        <WalletBreakdown
          data={breakdown}
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
                        {tab === "store" ? "Store" : "Business"}
                      </button>
                    );
                  })}
                </div>
              )}
              <DateRangePicker value={range} onChange={setRange} />
            </div>
          }
          bare
        />
      </Accordion>

      <Accordion
        id="wallet-history"
        title="Wallet passbook"
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
        <WalletPassbook
          data={passbook}
          onPageChange={setPage}
          showStatus
          bare
          onViewReceipt={setViewingReceipt}
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
                        {tab === "store" ? "Store" : "Business"}
                      </button>
                    );
                  })}
                </div>
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
                href={walletService.statementUrl({ userId, walletType: passbookTab, from: range.from, to: range.to })}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download CSV
              </a>
            </div>
          }
        />
      </Accordion>

      {expenseOpen && (
        <RecordExpenseDialog
          userId={userId}
          customerName={customerName}
          businessEligible={summary?.businessEligible ?? false}
          kycApproved={summary?.kycApproved ?? false}
          onClose={() => setExpenseOpen(false)}
          onRecorded={(message) => {
            addToast(message, "success");
            setExpenseOpen(false);
            refreshAll();
          }}
        />
      )}

      {/*
        Assisted online payment. Reuses the customer's own dialog with `onBehalfOf` so the two
        cannot drift apart — the amount bounds, the terms acknowledgement and the KYC warning
        are all the same code, just addressed to the admin instead of the customer.
      */}
      {onlineFundsFor && (
        <AddMoneyDialog
          walletType={onlineFundsFor}
          kycApproved={summary?.kycApproved ?? false}
          onBehalfOf={{ userId, customerName }}
          // Lets the admin switch wallets inside the dialog, matching how the expense and
          // offline-funds dialogs already work.
          allowWalletChange={summary?.businessEligible ? setOnlineFundsFor : undefined}
          onClose={() => setOnlineFundsFor(null)}
          onCredited={() => {
            setOnlineFundsFor(null);
            refreshAll();
          }}
        />
      )}

      {fundsOpen && (
        <AddFundsOfflineDialog
          userId={userId}
          customerName={customerName}
          businessEligible={summary?.businessEligible ?? false}
          onClose={() => setFundsOpen(false)}
          onCredited={(message) => {
            addToast(message, "success");
            setFundsOpen(false);
            refreshAll();
          }}
        />
      )}

      <WalletReceiptDialog
        open={!!viewingReceipt}
        onOpenChange={(open) => {
          if (!open) setViewingReceipt(null);
        }}
        transaction={viewingReceipt}
        customerName={customerName}
      />

      {summary?.store && (
        <TransferFundsDialog
          customerName={customerName}
          availableBalance={summary.store.availableBalance}
          open={transferOpen}
          onClose={() => setTransferOpen(false)}
          onConfirm={handleTransferConfirm}
        />
      )}

      {freezeActionFor && (
        <FreezeWalletDialog
          walletType={freezeActionFor.type}
          isFreezing={freezeActionFor.isFreezing}
          open={!!freezeActionFor}
          onClose={() => setFreezeActionFor(null)}
          onConfirm={handleToggleFreezeConfirm}
        />
      )}
    </div>
  );
}
