"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { invoiceService } from "@/services/invoiceService";
import { Invoice } from "@/types";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface QuoteSelectorStepProps {
  onSelectQuote: (quote: Invoice) => void;
  onClose: () => void;
}

export function QuoteSelectorStep({ onSelectQuote, onClose }: QuoteSelectorStepProps) {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [matchingQuotes, setMatchingQuotes] = React.useState<Invoice[]>([]);
  const [errorMsg, setErrorMsg] = React.useState("");

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await invoiceService.getInvoices({
        type: "quote",
        search: query.trim(),
        limit: 15,
      });
      const data = res as { invoices?: Invoice[] } | Invoice[];
      const list = Array.isArray(data) ? data : data.invoices || [];
      // Filter out converted quotes just in case
      const unconverted = list.filter((q) => q.status !== "converted");
      setMatchingQuotes(unconverted);
      if (unconverted.length === 0) {
        setErrorMsg("No unconverted active quotes found matching the search query.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to query quotes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex gap-2">
        <Input
          placeholder="Search quotes by Quote ID, Customer Name, Email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="text-sm flex-1"
        />
        <Button onClick={handleSearch} disabled={loading} className="font-semibold bg-primary text-primary-foreground">
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {errorMsg && <p className="text-xs text-red-500 font-medium">{errorMsg}</p>}

      <div className="space-y-3">
        <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Matching active quotes</h3>
        {matchingQuotes.length === 0 ? (
          <div className="border border-dashed rounded-lg p-8 text-center text-sm text-muted-foreground">
            No matching unconverted quotes. Input a keyword above and search.
            <div className="mt-4">
              <Link href="/admin/invoices?createQuote=true" onClick={onClose}>
                <Button variant="outline" size="sm" className="font-semibold cursor-pointer">
                  Create New Quote First
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
            {matchingQuotes.map((q) => (
              <div key={q._id} className="p-4 hover:bg-secondary/10 flex justify-between items-center transition-colors">
                <div>
                  <p className="font-bold text-sm text-foreground">{q._id}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {q.customerName} ({q.customerEmail})
                  </p>
                  <p className="text-[10px] text-primary mt-1 font-semibold">
                    Salesperson: {q.salesperson || "None"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-foreground">{formatPrice(q.amount)}</span>
                  <Button size="sm" onClick={() => onSelectQuote(q)} className="font-semibold text-xs cursor-pointer bg-primary text-primary-foreground">
                    Select Quote
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
