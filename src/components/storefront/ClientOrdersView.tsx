"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Filter, Eye, Download, Info, FileText, RotateCcw } from "lucide-react";
import { useOrderStore, Order } from "@/stores/orderStore";
import { useDashboardViewStore } from "@/stores/dashboardViewStore";
import { useCartStore } from "@/stores/cartStore";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { formatPrice } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/datetime";
import { OrderFulfillmentStepper } from "@/components/storefront/OrderFulfillmentStepper";
import { Pagination } from "@/components/ui/Pagination";
import { ViewDetailsDialog } from "@/components/ui/ViewDetailsDialog";

export function ClientOrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successOrderId = searchParams.get("success");

  const { orders, initializeOrders } = useOrderStore();
  const { addToast } = useToastStore();
  const [searchTerm, setSearchTerm] = React.useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = React.useState(searchParams.get("status") || "");
  const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || "");
  const [currentPage, setCurrentPage] = React.useState(Number(searchParams.get("page")) || 1);
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);
  const [reorderingId, setReorderingId] = React.useState<string | null>(null);

  // Sync active filters to URL search parameters
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (searchTerm.trim()) params.set("search", searchTerm.trim()); else params.delete("search");
    if (statusFilter) params.set("status", statusFilter); else params.delete("status");
    if (startDate) params.set("startDate", startDate); else params.delete("startDate");
    if (endDate) params.set("endDate", endDate); else params.delete("endDate");
    if (currentPage > 1) params.set("page", String(currentPage)); else params.delete("page");

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [searchTerm, statusFilter, startDate, endDate, currentPage]);

  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();

  const truncateString = (str: string, max: number = 50) => {
    if (!str) return str;
    return str.length > max ? str.substring(0, max) + "..." : str;
  };

  const handleReorder = async (order: Order) => {
    setReorderingId(order._id);
    try {
      await useProductStore.getState().initializeProducts();
      const addItem = useCartStore.getState().addItem;
      for (const item of order.items || []) {
        addItem(item.product, item.selectedVariants, item.quantity);
      }
      addToast("Available items from this order have been added to your cart.", "success");
      router.push("/cart");
    } catch {
      addToast("Failed to reorder — some items may no longer be available.", "error");
    } finally {
      setReorderingId(null);
    }
  };

  // Filter orders dynamically based on active dashboard view
  const { activeView } = useDashboardViewStore();

  /**
   * Re-fetch when the dashboard view changes.
   *
   * The server now scopes by `orderType` and validates it against the account's own
   * `customerTypes`, so the tab is enforced rather than being a display convention the
   * client could get wrong — which is exactly how B2B COD orders ended up listed under
   * Dropshipping. The client-side filter below still runs, so a stale cache never shows
   * the wrong tab's orders in the gap before this resolves.
   */
  React.useEffect(() => {
    initializeOrders({ orderType: activeView });
  }, [initializeOrders, activeView]);

  const filteredOrders = React.useMemo(() => {
    let viewFiltered = orders.filter(o => {
      /**
       * `orderType` is the authority, and it is the only thing consulted here.
       *
       * This used to infer the category from line-item price tiers, with a Dropshipping
       * branch of `hasDropshipItem || (!hasB2BItem && paymentMethod === "COD")` — so **any
       * non-B2B COD order was claimed as Dropshipping**. A B2B order whose items had not
       * resolved to the B2B tier (quantity under the MOQ, or a legacy line carrying no
       * `priceTier`) therefore surfaced in the customer's Dropshipping tab.
       *
       * `orderType` is set by the server, indexed, and already what the admin dashboard
       * filters on. Legacy orders predating the field are treated as B2B, matching the
       * server's own convention in /api/orders.
       */
      const orderType = (o as any).orderType || "B2B";
      return orderType === activeView;
    });

    if (statusFilter) {
      viewFiltered = viewFiltered.filter(o => o.status === statusFilter);
    }
    
    if (startDate) {
      viewFiltered = viewFiltered.filter(o => {
        if (!o.date) return false;
        const d = new Date(o.date).toISOString().split('T')[0];
        return d >= startDate;
      });
    }

    if (endDate) {
      viewFiltered = viewFiltered.filter(o => {
        if (!o.date) return false;
        const d = new Date(o.date).toISOString().split('T')[0];
        return d <= endDate;
      });
    }

    const term = searchTerm.toLowerCase().trim();
    if (term) {
      viewFiltered = viewFiltered.filter(o => 
        o._id.toLowerCase().includes(term) || 
        ((o as any).orderId && (o as any).orderId.toLowerCase().includes(term)) ||
        o.customerName.toLowerCase().includes(term) ||
        o.items?.some((item: any) => 
          (item.sku && item.sku.toLowerCase().includes(term)) ||
          (item.productName && item.productName.toLowerCase().includes(term)) ||
          (item.product?.title && item.product.title.toLowerCase().includes(term))
        )
      );
    }
    return viewFiltered;
  }, [orders, searchTerm, activeView, statusFilter, startDate, endDate]);

  const ITEMS_PER_PAGE = 5;

  const isInitialMount = React.useRef(true);
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [searchTerm, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const paginatedOrders = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  return (
    <div className="space-y-6 text-foreground flex-1">
      {/* Checkout Success Banner */}
      {successOrderId && (
        <div className="bg-success/10 border border-success/30 p-4 rounded-lg flex items-start gap-3">
          <div className="bg-success text-success-foreground p-1 rounded-full text-xs font-bold">✓</div>
          <div>
            <h3 className="font-bold text-success">Wholesale Order Confirmed!</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your order <span className="font-bold font-mono text-foreground">{successOrderId}</span> has been generated successfully. Fulfillments will update in the log below.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Order History</h1>
          <p className="text-muted-foreground mt-1">View and track all your past and current wholesale shipments.</p>
        </div>
      </div>

      <div className="space-y-6 items-start">
        {/* Main Orders List Table */}
        <div className="w-full">
          <Card>
            <CardHeader className="flex flex-col gap-4 p-4 border-b">
              <div className="flex flex-col xl:flex-row gap-4 items-center justify-between w-full">
                <div className="relative w-full xl:w-72 flex-shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by order ID..." 
                    className="pl-9 text-foreground" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
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
                  {(startDate || endDate || statusFilter) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setStatusFilter("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
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
                      <th className="px-6 py-4">Order Details</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Total Amount</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                          No order records found.
                        </td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order) => (
                        <tr 
                          key={order._id} 
                          onClick={() => router.push(`/client/orders/${order._id}`)}
                          className="hover:bg-secondary/20 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4 font-mono max-w-[150px] truncate" title={order._id}>
                            <p className="font-bold truncate">{truncateString(order._id, 20)}</p>
                            <p className="text-xs text-muted-foreground mt-1">{order.itemsCount} items</p>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">{formatDateTimeIST((order as any).createdAt ?? order.date)}</td>
                          <td className="px-6 py-4 font-bold">{formatPrice(order.amount)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${order.statusClass}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold px-3 h-8"
                              disabled={reorderingId === order._id}
                              onClick={() => handleReorder(order)}
                            >
                              Reorder
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Quick Preview"
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Link href={`/client/orders/${order._id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Open Tax Invoice"
                              >
                                <FileText className="h-4 w-4 text-primary" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 pb-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filteredOrders.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Dialog for Selected Order */}
      <ViewDetailsDialog 
        isOpen={selectedOrder !== null}
        onClose={() => setSelectedOrder(null)}
        title="Order Details"
        // Customers get a fulfilment timeline for the first time here. It renders the
        // customer-safe notes only — and the API has already stripped the internal ones.
        footer={<OrderFulfillmentStepper history={selectedOrder?.history} variant="customer" />}
        data={selectedOrder ? {
          "Order ID": selectedOrder._id,
          "Date": formatDateTimeIST((selectedOrder as any).createdAt ?? selectedOrder.date),
          "Status": selectedOrder.status,
          "Total Amount": formatPrice(selectedOrder.amount),
          "Payment Method": selectedOrder.paymentMethod || "N/A",
          "Shipping To": `${selectedOrder.shippingAddress?.firstName} ${selectedOrder.shippingAddress?.lastName}`,
          "Company": selectedOrder.shippingAddress?.company || "N/A",
          "Address": `${selectedOrder.shippingAddress?.address}, ${selectedOrder.shippingAddress?.city}, ${selectedOrder.shippingAddress?.state} - ${selectedOrder.shippingAddress?.pinCode}`,
          "Phone": selectedOrder.shippingAddress?.phone || "N/A",
          "Items": selectedOrder.items?.map(item => `${item.product?.title} (Qty: ${item.quantity} x ${formatPrice(item.pricePerUnit)})`).join(" | ") || "Mock items",
        } : {}}
      />
    </div>
  );
}
