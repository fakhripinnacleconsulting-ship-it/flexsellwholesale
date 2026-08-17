"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/Table";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { AlertCircle, Download, FileText, Search, CreditCard, Banknote } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import Link from "next/link";
import { useToastStore } from "@/stores/toastStore";

interface OfflineEntry {
  _id: string;
  createdAt: string;
  userId: string;
  walletType: string;
  source: string;
  amount: string;
  referenceId?: string;
  description?: string;
  proofUrl?: string;
  status: string;
  receiptNumber: string;
  recordedBy: string;
  recordedByIp?: string;
}

interface SummaryGroup {
  admin: string;
  source: string;
  total: string;
  count: number;
}

interface OfflineRegisterData {
  days: number;
  totalCredited: string;
  summary: SummaryGroup[];
  entries: OfflineEntry[];
}

export default function OfflineRegisterPage() {
  const [data, setData] = useState<OfflineRegisterData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState(30);
  const { addToast } = useToastStore();

  useEffect(() => {
    fetchData();
  }, [days]);

  const fetchData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await apiClient.get<OfflineRegisterData>(`/wallet/offline-register?days=${days}`);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to load offline register");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!data || !data.entries.length) {
      addToast({ title: "Nothing to export", type: "error" });
      return;
    }

    const headers = [
      "Date", "Receipt", "Customer ID", "Wallet", "Amount", "Source", "Reference", "Recorded By", "IP Address"
    ];
    
    const rows = data.entries.map(e => [
      format(new Date(e.createdAt), "yyyy-MM-dd HH:mm:ss"),
      e.receiptNumber,
      e.userId,
      e.walletType,
      e.amount.replace(/₹|,/g, "").trim(),
      e.source,
      e.referenceId || "-",
      e.recordedBy,
      e.recordedByIp || "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `offline-credits-${days}d-${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Offline Credit Register</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audit trail of all non-gateway funds added by staff.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm bg-card border border-border rounded-md px-3 py-2 outline-none focus:border-primary"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last 1 Year</option>
          </select>
          <button 
            onClick={downloadCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {error ? (
        <ErrorState title="Failed to load offline register" description={error} onRetry={fetchData} className="border-0 bg-transparent py-8" />
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Total Offline Credit ({data.days}d)
              </h3>
              <p className="text-3xl font-bold text-foreground mt-2">{data.totalCredited}</p>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm md:col-span-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Top Contributors</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {data.summary.length > 0 ? data.summary.slice(0, 4).map((s, idx) => (
                  <div key={idx} className="flex-shrink-0 border-l-2 border-primary pl-3">
                    <p className="text-sm font-semibold">{s.admin}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.source} • {s.count} txns</p>
                    <p className="text-sm font-medium text-primary mt-1">{s.total}</p>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt & Ref</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount & Source</TableHead>
                    <TableHead className="text-right">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No offline credits found in the selected period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.entries.map((entry) => (
                      <TableRow key={entry._id}>
                        <TableCell className="whitespace-nowrap">
                          <p className="text-sm font-medium">{format(new Date(entry.createdAt), "MMM d, yyyy")}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(entry.createdAt), "h:mm a")}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-mono text-foreground">{entry.receiptNumber}</p>
                          {entry.referenceId && (
                            <p className="text-xs text-muted-foreground">Ref: {entry.referenceId}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{entry.recordedBy}</p>
                          {entry.recordedByIp && (
                            <p className="text-[10px] text-muted-foreground font-mono">{entry.recordedByIp}</p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/customers/${entry.userId}`} className="text-sm text-primary hover:underline font-mono">
                            {entry.userId}
                          </Link>
                          <p className="text-xs text-muted-foreground capitalize">{entry.walletType} Wallet</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{entry.amount}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {entry.source === "cash" ? <Banknote className="w-3 h-3 text-muted-foreground" /> : <CreditCard className="w-3 h-3 text-muted-foreground" />}
                            <p className="text-xs text-muted-foreground capitalize">{entry.source.replace("_", " ")}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {entry.proofUrl ? (
                            <a 
                              href={entry.proofUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                              title="View Proof Document"
                            >
                              <FileText className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
