"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface InvoiceTableFiltersProps {
  activeTab: "invoice" | "receipt" | "quote" | "company_info";
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  createdByFilter?: string;
  setCreatedByFilter?: (val: string) => void;
}

export function InvoiceTableFilters({
  activeTab,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  createdByFilter = "all",
  setCreatedByFilter,
}: InvoiceTableFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border-b">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${
            activeTab === "invoice" ? "invoices" : activeTab === "receipt" ? "receipts" : "quotes"
          }...`}
          className="pl-9 text-foreground text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        {setCreatedByFilter && (
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="bg-background text-foreground text-xs font-semibold px-3 py-2 border rounded-md cursor-pointer"
            title="Filter by Created By"
          >
            <option value="all">Created By: All</option>
            <option value="me">Created By: Me</option>
            <option value="role:Admin">Created By: Admin</option>
            <option value="role:Manager">Created By: Manager</option>
            <option value="role:Customer">Created By: Customer</option>
            <option value="role:System">Created By: System</option>
          </select>
        )}

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background text-foreground text-xs font-semibold px-3 py-2 border rounded-md"
        >
          <option value="">All Statuses</option>
          {activeTab === "quote" && (
            <>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="finalized">Finalized</option>
              <option value="converted">Converted to Order</option>
            </>
          )}
          {activeTab === "receipt" && (
            <>
              <option value="pending">Pending Payment</option>
              <option value="failed">Payment Failed</option>
            </>
          )}
          {activeTab === "invoice" && (
            <>
              <option value="paid">Paid (Tax Invoice)</option>
              <option value="void">Voided / Cancelled</option>
              <option value="archived">Archived</option>
            </>
          )}
        </select>

        <div className="flex items-center gap-1">
          <Input
            type="date"
            className="h-8 py-0 px-2 text-xs w-28"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 py-0 px-2 text-xs w-28"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
