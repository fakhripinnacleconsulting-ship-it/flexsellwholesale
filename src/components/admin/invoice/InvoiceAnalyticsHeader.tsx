"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Invoice } from "@/types";
import { formatPrice } from "@/lib/utils";

interface InvoiceAnalyticsHeaderProps {
  activeTab: "invoice" | "receipt" | "quote" | "company_info";
  invoices: Invoice[];
}

export function InvoiceAnalyticsHeader({ activeTab, invoices }: InvoiceAnalyticsHeaderProps) {
  if (activeTab === "company_info") return null;

  const totalValue = invoices.reduce((sum, i) => sum + (i.amount || 0), 0);
  // A quote's successful outcome is `accepted`. `converted` is folded in for quotes created
  // before conversion was removed — counting only that would have read 0 for every new quote.
  const acceptedOrPaidCount = activeTab === "quote"
    ? invoices.filter(i => i.status === "accepted" || i.status === "converted").length
    : invoices.filter(i => i.status === "paid").length;
  const draftOrVoidCount = activeTab === "quote"
    ? invoices.filter(i => ["draft", "sent", "finalized"].includes(i.status)).length
    : activeTab === "receipt"
    ? invoices.filter(i => ["pending", "failed"].includes(i.status)).length
    : invoices.filter(i => i.status === "void").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {activeTab === "quote" ? "Total Quotes" : activeTab === "receipt" ? "Total Receipts" : "Total Invoices"}
            </p>
            <h3 className="text-lg font-black mt-1 text-foreground">{invoices.length}</h3>
          </div>
          <div className="p-2 rounded-lg bg-primary/5 text-primary text-base">
            📄
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Value</p>
            <h3 className="text-lg font-black mt-1 text-foreground">
              {formatPrice(totalValue)}
            </h3>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-base">
            💰
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {activeTab === "quote" ? "Accepted" : activeTab === "receipt" ? "Paid Receipts" : "Paid Invoices"}
            </p>
            <h3 className="text-lg font-black mt-1 text-foreground">
              {acceptedOrPaidCount}
            </h3>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-base">
            ✅
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60 shadow-xs">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {activeTab === "quote" ? "Active / Draft Quotes" : activeTab === "receipt" ? "Pending Receipts" : "Void / Cancelled"}
            </p>
            <h3 className="text-lg font-black mt-1 text-foreground">
              {draftOrVoidCount}
            </h3>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/5 text-amber-600 dark:text-amber-400 text-base">
            ⚠️
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
