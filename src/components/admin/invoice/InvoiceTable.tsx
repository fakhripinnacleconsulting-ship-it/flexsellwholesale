"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Eye, Edit, Trash2, Check, RefreshCw, Loader2 } from "lucide-react";
import { Invoice } from "@/types";
import { formatPrice } from "@/lib/utils";

interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  activeTab: "invoice" | "receipt" | "quote" | "company_info";
  page: number;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  onViewInvoice: (inv: Invoice) => void;
  onPayInvoice: (inv: Invoice) => void;
  onEditQuote: (inv: Invoice) => void;
  onVoidInvoice: (id: string) => void;
  onDeleteInvoice: (id: string) => void;
}

export function InvoiceTable({
  invoices,
  isLoading,
  activeTab,
  page,
  totalPages,
  setCurrentPage,
  onViewInvoice,
  onPayInvoice,
  onEditQuote,
  onVoidInvoice,
  onDeleteInvoice,
}: InvoiceTableProps) {
  if (activeTab === "company_info") return null;

  return (
    <Card className="w-full shadow-xs border-border/80">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b bg-secondary/15 text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                <th className="p-4">Doc Number</th>
                <th className="p-4">Customer</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4">Payment Method</th>
                <th className="p-4">Status</th>
                <th className="p-4">Generated Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading document records...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No {activeTab === "invoice" ? "invoices" : activeTab === "receipt" ? "receipts" : "quotes"} found matching criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-secondary/10 transition-colors">
                    <td className="p-4 font-mono font-bold text-foreground">
                      {inv._id}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{inv.customerName}</div>
                      <div className="text-[11px] text-muted-foreground">{inv.customerEmail}</div>
                      {inv.customerGstin && (
                        <div className="text-[10px] text-muted-foreground font-mono">GST: {inv.customerGstin}</div>
                      )}
                    </td>
                    <td className="p-4 text-right font-black text-foreground">
                      {formatPrice(inv.amount)}
                    </td>
                    <td className="p-4">
                      <span className="bg-secondary/30 px-2 py-1 rounded font-semibold text-[11px]">
                        {inv.paymentMethod || "N/A"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : inv.status === "converted"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : inv.status === "void"
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(inv.generatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewInvoice(inv)}
                          title="View Document Details & Print"
                          className="h-8 w-8 p-0 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {inv.type === "quote" && inv.status !== "converted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditQuote(inv)}
                            title="Edit Quote Items & Quantities"
                            className="h-8 w-8 p-0 cursor-pointer text-blue-600 hover:text-blue-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

                        {inv.type === "receipt" && inv.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPayInvoice(inv)}
                            title="Receive Payment & Convert to Tax Invoice"
                            className="h-8 text-xs font-semibold px-2 cursor-pointer bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                          >
                            <Check className="h-3.5 w-3.5 mr-1" /> Mark Paid
                          </Button>
                        )}

                        {inv.status !== "void" && inv.type !== "quote" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onVoidInvoice(inv._id)}
                            title="Void Document"
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 cursor-pointer"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteInvoice(inv._id)}
                          title="Delete Record"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-xs text-muted-foreground">
            <div>
              Page <span className="font-bold text-foreground">{page}</span> of <span className="font-bold text-foreground">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="cursor-pointer"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="cursor-pointer"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

