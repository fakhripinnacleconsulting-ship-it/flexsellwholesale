"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye } from "lucide-react";
import { apiClient } from "@/lib/apiClient";
import { formatPrice } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";
import { Pagination } from "@/components/ui/Pagination";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";

interface InvoiceListProps {
  title: string;
  description: string;
  docType: string;
}

export function InvoiceList({ title, description, docType }: InvoiceListProps) {
  const [invoices, setInvoices] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { addToast } = useToastStore();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);
  const [totalItems, setTotalItems] = React.useState(0);
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const fetchInvoices = React.useCallback(async () => {
    try {
      setIsLoading(true);
      let endpoint = `/invoices?page=${currentPage}&limit=${itemsPerPage}&type=${docType}`;
      if (searchTerm) endpoint += `&search=${encodeURIComponent(searchTerm)}`;
      
      const data = await apiClient.get<any>(endpoint);
      setInvoices(data.invoices || []);
      setTotalItems(data.total || 0);
    } catch (err: any) {
      addToast(err.message || "Failed to load documents", "error");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, itemsPerPage, docType, searchTerm, addToast]);

  React.useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchInvoices();
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4 bg-card rounded-t-xl">
          <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, Customer..."
                className="pl-9 h-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-9">Search</Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div 
            className="overflow-x-auto min-h-[400px] cursor-grab active:cursor-grabbing select-none"
            ref={ref}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            <table className="w-full text-sm text-left whitespace-nowrap" onDragStart={onDragStart}>
              <thead className="text-xs text-muted-foreground uppercase bg-secondary border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Document ID</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Customer</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">Loading documents...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No documents found.</td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium">{inv._id}</td>
                      <td className="px-6 py-4">{inv.generatedAt}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold">{inv.customerName}</p>
                        <p className="text-muted-foreground">{inv.customerEmail}</p>
                      </td>
                      <td className="px-6 py-4 font-black">{formatPrice(inv.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${
                           inv.status === "paid" ? "bg-green-100 text-green-700" :
                           inv.status === "cancelled" ? "bg-red-100 text-red-700" :
                           "bg-amber-100 text-amber-700"
                        }`}>{inv.status}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <Link href={`/manager/documents/${inv._id}`}>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" title="View Document">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                         </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 pb-1 pt-0 border-t">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
