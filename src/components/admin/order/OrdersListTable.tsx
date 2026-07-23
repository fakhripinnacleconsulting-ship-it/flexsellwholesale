"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye, FileText } from "lucide-react";
import { Order } from "@/stores/orderStore";
import { formatPrice } from "@/lib/utils";
import { ShippingLabelDocument } from "@/components/documents/ShippingLabelDocument";

interface OrdersListTableProps {
  orders: Order[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  selectedOrderId: string | null;
  onSelectOrder: (order: Order) => void;
  originFilter: "" | "self" | "website";
  setOriginFilter: (val: "" | "self" | "website") => void;
}

export function OrdersListTable({
  orders,
  searchTerm,
  setSearchTerm,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  selectedOrderId,
  onSelectOrder,
  originFilter,
  setOriginFilter,
}: OrdersListTableProps) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [selectedLabelOrder, setSelectedLabelOrder] = React.useState<Order | null>(null);
  const ITEMS_PER_PAGE = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, originFilter]);

  const filteredOrders = React.useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return orders;
    return orders.filter(
      (o) =>
        o._id.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border-b">
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search orders by ID or customer..."
            className="pl-9 text-foreground text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Origin Dropdown */}
          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
          >
            <option value="">All Origins</option>
            <option value="self">Self Orders (Admin)</option>
            <option value="website">Website Orders</option>
          </select>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">From:</span>
            <Input
              type="date"
              className="w-32 text-foreground h-9 px-2 py-1 text-xs"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">To:</span>
            <Input
              type="date"
              className="w-32 text-foreground h-9 px-2 py-1 text-xs"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {(startDate || endDate || originFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setOriginFilter("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-6 py-4">Order ID & Origin</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Fulfillment Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground italic">
                    No order records found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => {
                      onSelectOrder(order);
                      router.push(`/admin/orders/${order._id}`);
                    }}
                    className={`hover:bg-secondary/20 transition-colors border-b last:border-0 cursor-pointer ${
                      selectedOrderId === order._id ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-mono font-bold text-foreground block">{order._id}</span>
                        <div className="flex gap-1 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            order.origin === "self" 
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" 
                              : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400"
                          }`}>
                            {order.origin === "self" ? "Self" : "Website"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground text-[8px] font-bold uppercase tracking-wide">
                            {order.orderType || "B2B"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{order.date}</td>
                    <td className="px-6 py-4 font-semibold text-foreground">
                      {order.customerName}
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {formatPrice(order.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.status === "Delivered"
                            ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400"
                            : order.status === "Shipped"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400"
                            : order.status === "Cancelled"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {order.shipmentDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              if (order.shipmentDetails?.type === "shiprocket") {
                                try {
                                  const res = await fetch(`/api/shiprocket/label/${order._id}`);
                                  const data = await res.json();
                                  if (data.labelUrl) {
                                    window.open(data.labelUrl, "_blank");
                                    return;
                                  }
                                } catch {}
                              }
                              setSelectedLabelOrder(order);
                            }}
                            className="flex items-center gap-1 h-8 text-xs cursor-pointer font-semibold border-primary/30 text-primary hover:bg-primary/10"
                            title="Print Package Shipping Label"
                          >
                            <FileText className="h-3.5 w-3.5" /> Label
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onSelectOrder(order);
                            router.push(`/admin/orders/${order._id}`);
                          }}
                          className="flex items-center gap-1.5 h-8 text-xs cursor-pointer font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5" /> View Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-4 border-t flex justify-between items-center text-xs">
            <span className="text-muted-foreground">
              Showing page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Shipping Label Modal */}
      {selectedLabelOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-card border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-4 text-foreground">
            <ShippingLabelDocument
              order={selectedLabelOrder}
              onClose={() => setSelectedLabelOrder(null)}
            />
          </div>
        </div>
      )}
    </Card>
  );
}
