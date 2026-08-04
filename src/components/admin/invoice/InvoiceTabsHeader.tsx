"use client";

import * as React from "react";
import { FileText, Check, Building } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

interface InvoiceTabsHeaderProps {
  activeTab: "invoice" | "receipt" | "quote" | "company_info";
  setActiveTab: (tab: "invoice" | "receipt" | "quote" | "company_info") => void;
  activeSubTab: "B2B" | "B2C" | "Dropshipping";
  setActiveSubTab: (subTab: "B2B" | "B2C" | "Dropshipping") => void;
  onTabChange: () => void;
}

export function InvoiceTabsHeader({
  activeTab,
  setActiveTab,
  activeSubTab,
  setActiveSubTab,
  onTabChange,
}: InvoiceTabsHeaderProps) {
  const { hasPermission } = usePermissions();
  const canQuotes = hasPermission("invoices_quote");
  const canReceipts = hasPermission("invoices_receipt");
  const canInvoices = hasPermission("invoices_invoice");
  const canSettings = hasPermission("invoices_settings");
  
  const canB2B = hasPermission("orders_b2b") || hasPermission("customers_b2b");
  const canB2C = hasPermission("orders_b2c") || hasPermission("customers_b2c");
  const canDropshipping = hasPermission("orders_dropshipping") || hasPermission("orders_dropship") || hasPermission("customers_dropshipping");

  return (
    <div className="space-y-4">
      {/* Top Main Tabs */}
      <div className="flex border-b border-border/80 overflow-x-auto whitespace-nowrap scrollbar-none">
        {canQuotes && (
        <button
          onClick={() => {
            setActiveTab("quote");
            onTabChange();
          }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "quote"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" /> Price Quotes
        </button>
        )}
        {canReceipts && (
        <button
          onClick={() => {
            setActiveTab("receipt");
            onTabChange();
          }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "receipt"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Check className="h-4 w-4" /> Payment Receipts (Failed/Draft)
        </button>
        )}
        {canInvoices && (
        <button
          onClick={() => {
            setActiveTab("invoice");
            onTabChange();
          }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "invoice"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" /> Commercial Invoices
        </button>
        )}
        {canSettings && (
        <button
          onClick={() => {
            setActiveTab("company_info");
          }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "company_info"
              ? "border-primary text-primary font-bold bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building className="h-4 w-4" /> Company Information
        </button>
        )}
      </div>

      {/* Sub-Tabs for Client Ordering Mode */}
      {activeTab !== "quote" && activeTab !== "company_info" && (
        <div className="flex gap-2 border-b border-border/40 py-2 bg-secondary/10 px-4 rounded-lg overflow-x-auto whitespace-nowrap">
          {canB2B && (
          <button
            onClick={() => setActiveSubTab("B2B")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeSubTab === "B2B"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            💼 B2B Business {activeTab === "invoice" ? "Invoices" : "Receipts"}
          </button>
          )}
          {canB2C && (
          <button
            onClick={() => setActiveSubTab("B2C")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeSubTab === "B2C"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            🛍️ B2C Retail {activeTab === "invoice" ? "Invoices" : "Receipts"}
          </button>
          )}
          {canDropshipping && (
          <button
            onClick={() => setActiveSubTab("Dropshipping")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              activeSubTab === "Dropshipping"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            📦 Dropshipping
          </button>
          )}
        </div>
      )}
    </div>
  );
}
