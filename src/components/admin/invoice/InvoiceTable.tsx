"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Eye, Edit, Trash2, Check, RefreshCw, Loader2, ShoppingBag } from "lucide-react";
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
  onConvertQuote?: (inv: Invoice) => void;
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
  onConvertQuote,
  onVoidInvoice,
  onDeleteInvoice,
}: InvoiceTableProps) {
  if (isLoading) {
    return (
      <Card className="border border-border">
        <CardContent className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Loading documents...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border shadow-xs">
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-secondary/40 text-muted-foreground uppercase text-[10px] font-bold border-b border-border">
              <tr>
                <th className="p-4">Document ID</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4 text-right">Grand Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Generated Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No documents found matching the search criteria.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-4 font-mono font-bold text-foreground">
                      {inv._id}
                      {inv.orderId && (
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          Order: {inv.orderId}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{inv.customerName}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.customerEmail}</p>
                    </td>
                    <td className="p-4 text-right font-bold text-foreground font-mono">
                      {formatPrice(inv.amount)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                          inv.status === "paid" || inv.status === "finalized"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : inv.status === "converted"
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : inv.status === "pending" || inv.status === "sent"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : inv.status === "void"
                            ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                            : "bg-secondary text-muted-foreground"
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
                          <>
                            {onConvertQuote && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onConvertQuote(inv)}
                                title="Convert Quote to Order"
                                className="h-8 text-xs font-semibold px-2 cursor-pointer bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
                              >
                                <ShoppingBag className="h-3.5 w-3.5 mr-1" /> Convert
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditQuote(inv)}
                              title="Edit Quote Items & Quantities"
                              className="h-8 w-8 p-0 cursor-pointer text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
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

                        {inv.type !== "invoice" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteInvoice(inv._id)}
                            title="Delete Record"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
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

