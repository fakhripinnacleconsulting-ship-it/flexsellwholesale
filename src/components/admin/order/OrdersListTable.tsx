"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye, FileText } from "lucide-react";
import { Order } from "@/stores/orderStore";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { formatPrice } from "@/lib/utils";
import { CreatedByBadge } from "@/components/common/CreatedByBadge";
import { ShippingLabelDocument } from "@/components/documents/ShippingLabelDocument";
import { useAuthStore } from "@/stores/authStore";

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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const basePath = pathname.startsWith("/manager") ? "/manager" : "/admin";
  const [currentPage, setCurrentPage] = React.useState(Number(searchParams.get("page")) || 1);
  const [selectedLabelOrder, setSelectedLabelOrder] = React.useState<Order | null>(null);
  const ITEMS_PER_PAGE = 10;

  const { manager } = useAuthStore();
  const [statusFilter, setStatusFilter] = React.useState<string>(searchParams.get("status") || "");
  const [paymentStatusFilter, setPaymentStatusFilter] = React.useState<string>(searchParams.get("paymentStatus") || "");
  const [createdByFilter, setCreatedByFilter] = React.useState<string>(searchParams.get("createdBy") || (basePath === "/manager" ? "me" : "all"));

  // Sync internal table filters to URL query string
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (statusFilter) params.set("status", statusFilter); else params.delete("status");
    if (paymentStatusFilter) params.set("paymentStatus", paymentStatusFilter); else params.delete("paymentStatus");
    if (createdByFilter && createdByFilter !== (basePath === "/manager" ? "me" : "all")) params.set("createdBy", createdByFilter); else params.delete("createdBy");
    if (currentPage > 1) params.set("page", String(currentPage)); else params.delete("page");

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [statusFilter, paymentStatusFilter, createdByFilter, currentPage, basePath]);

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, originFilter, statusFilter, paymentStatusFilter, createdByFilter]);

  const filteredOrders = React.useMemo(() => {
    let result = orders;
    if (statusFilter) {
      result = result.filter(o => o.status === statusFilter);
    }
    if (paymentStatusFilter) {
      result = result.filter(o => o.paymentStatus === paymentStatusFilter);
    }
    if (createdByFilter && createdByFilter !== "all") {
      if (createdByFilter === "me") {
        result = result.filter(o => {
          if (o.createdBy?.userId) {
            return o.createdBy.userId === manager?._id || o.createdBy.email === manager?.email;
          }
          if (o.createdBy?.name) {
            return manager?.name && o.createdBy.name.toLowerCase() === manager.name.toLowerCase();
          }
          if ((o as any).generatedBy) {
            const handle = manager?.email ? manager.email.split("@")[0].toLowerCase() : "";
            const mgrName = manager?.name ? manager.name.toLowerCase() : "";
            const gen = String((o as any).generatedBy).toLowerCase();
            return (handle && gen.includes(handle)) || (mgrName && gen.includes(mgrName));
          }
          return false;
        });
      } else if (createdByFilter.startsWith("role:")) {
        const targetRole = createdByFilter.replace("role:", "");
        result = result.filter(o => o.createdBy?.role === targetRole);
      }
    }

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      result = result.filter(
        (o) =>
          o._id.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term)
      );
    }
    return result;
  }, [orders, searchTerm, statusFilter, paymentStatusFilter, createdByFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const truncateString = (str: string, max: number = 50) => {
    if (!str) return str;
    return str.length > max ? str.substring(0, max) + "..." : str;
  };

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
          <select
            value={createdByFilter}
            onChange={(e) => setCreatedByFilter(e.target.value)}
            className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
            title="Filter by Created By"
          >
            <option value="all">Created By: All</option>
            <option value="me">Created By: Me</option>
            <option value="role:Admin">Created By: Admin</option>
            <option value="role:Manager">Created By: Manager</option>
            <option value="role:Customer">Created By: Customer</option>
            <option value="role:System">Created By: System</option>
          </select>

          <select
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as any)}
            className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
          >
            <option value="">All Origins</option>
            <option value="self">Self Orders (Admin)</option>
            <option value="website">Website Orders</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={paymentStatusFilter}
            onChange={(e) => setPaymentStatusFilter(e.target.value)}
            className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
          >
            <option value="">All Payments</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
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
          {(startDate || endDate || originFilter || statusFilter || paymentStatusFilter || (createdByFilter !== (basePath === "/manager" ? "me" : "all"))) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setOriginFilter("");
                setStatusFilter("");
                setPaymentStatusFilter("");
                setCreatedByFilter(basePath === "/manager" ? "me" : "all");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          className="overflow-x-auto custom-scrollbar cursor-grab active:cursor-grabbing select-none"
          ref={ref}
          onMouseDown={onMouseDown}
          onMouseLeave={onMouseLeave}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
        >
          <table className="w-full text-sm text-left whitespace-nowrap" onDragStart={onDragStart}>
            <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wide">Order ID & Origin</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Date</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Customer</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Created By</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Total Amount</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Fulfillment Status</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-muted-foreground italic">
                    No order records found.
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order._id}
                    onClick={() => {
                      onSelectOrder(order);
                      router.push(`${basePath}/orders/${order._id}`);
                    }}
                    className={`hover:bg-secondary/20 transition-colors border-b last:border-0 cursor-pointer ${
                      selectedOrderId === order._id ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <td className="px-6 py-4 max-w-[150px]">
                      <div>
                        <span className="font-mono font-bold text-foreground block truncate" title={order._id}>{truncateString(order._id, 20)}</span>
                        <div className="flex gap-1 mt-1">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            order.origin === "self" 
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400" 
                              : "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-400"
                          }`}>
                            {order.origin === "self" ? "Self" : "Website"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border ${
                              order.orderType === "Dropshipping"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : order.orderType === "B2C"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                                : "bg-primary/10 text-primary border-primary/30"
                            }`}
                          >
                            {order.orderType || "B2B"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{order.date}</td>
                    <td className="px-6 py-4 font-semibold text-foreground max-w-[200px] truncate" title={order.customerName}>
                      {truncateString(order.customerName, 40)}
                    </td>
                    <td className="px-6 py-4">
                      <CreatedByBadge
                        createdBy={order.createdBy}
                        customerName={order.customerName}
                        origin={order.origin}
                        docType="order"
                      />
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
                            router.push(`${basePath}/orders/${order._id}`);
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
        <ShippingLabelDocument
          order={selectedLabelOrder}
          onClose={() => setSelectedLabelOrder(null)}
        />
      )}
    </Card>
  );
}

