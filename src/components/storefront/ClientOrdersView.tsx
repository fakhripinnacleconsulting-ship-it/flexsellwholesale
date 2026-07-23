"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Filter, Eye, Download, Info, FileText } from "lucide-react";
import { useOrderStore, Order } from "@/stores/orderStore";
import { useDashboardViewStore } from "@/stores/dashboardViewStore";
import { formatPrice } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";

export function ClientOrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const successOrderId = searchParams.get("success");

  const { orders, initializeOrders } = useOrderStore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  // Initialize store if empty
  React.useEffect(() => {
    initializeOrders();
  }, [initializeOrders]);

  // Filter orders dynamically based on active dashboard view
  const { activeView } = useDashboardViewStore();

  const filteredOrders = React.useMemo(() => {
    const viewFiltered = orders.filter(o => {
      const hasB2BItem = o.items?.some((item: any) => item.priceTier === "B2B");
      const hasDropshipItem = o.items?.some((item: any) => item.priceTier === "Dropshipping");
      
      if (activeView === "B2B") {
        return hasB2BItem;
      }
      if (activeView === "Dropshipping") {
        return hasDropshipItem || (!hasB2BItem && o.paymentMethod === "COD");
      }
      return !hasB2BItem && !hasDropshipItem;
    });

    const term = searchTerm.toLowerCase().trim();
    if (!term) return viewFiltered;
    return viewFiltered.filter(o => 
      o._id.toLowerCase().includes(term) || 
      ((o as any).orderId && (o as any).orderId.toLowerCase().includes(term)) ||
      o.customerName.toLowerCase().includes(term) ||
      o.items?.some((item: any) => 
        (item.sku && item.sku.toLowerCase().includes(term)) ||
        (item.productName && item.productName.toLowerCase().includes(term)) ||
        (item.product?.title && item.product.title.toLowerCase().includes(term))
      )
    );
  }, [orders, searchTerm, activeView]);

  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 5;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Main Orders List Table */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border-b">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by order ID..." 
                  className="pl-9 text-foreground" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
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
                          <td className="px-6 py-4">
                            <p className="font-bold font-mono">{order._id}</p>
                            <p className="text-xs text-muted-foreground mt-1">{order.itemsCount} items</p>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                          <td className="px-6 py-4 font-bold">{formatPrice(order.amount)}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${order.statusClass}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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

        {/* Selected Order Detail Sidebar Panel */}
        <div>
          {selectedOrder ? (
            <Card className="sticky top-24">
              <CardHeader className="border-b pb-4 flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">Order Details</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{selectedOrder._id}</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                >
                  Clear
                </Button>
              </CardHeader>
              <CardContent className="pt-4 space-y-6 text-sm">
                <div>
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Shipping To:</h4>
                  <p className="font-bold">{selectedOrder.shippingAddress.firstName} {selectedOrder.shippingAddress.lastName}</p>
                  {selectedOrder.shippingAddress.company && (
                    <p className="text-xs text-muted-foreground font-medium">{selectedOrder.shippingAddress.company}</p>
                  )}
                  <p className="text-muted-foreground mt-1">{selectedOrder.shippingAddress.address}</p>
                  <p className="text-muted-foreground">{selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pinCode}</p>
                  <p className="text-muted-foreground mt-1">Phone: {selectedOrder.shippingAddress.phone}</p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Itemized Invoice:</h4>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, index) => (
                        <div key={`${item.product._id}-${index}`} className="flex justify-between items-start">
                          <div className="max-w-[70%]">
                            <p className="font-semibold text-foreground line-clamp-1">{item.product.title}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity} x {formatPrice(item.pricePerUnit)}</p>
                          </div>
                          <span className="font-medium text-foreground">{formatPrice(item.pricePerUnit * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Mock items details are packed.</p>
                  )}
                </div>

                <div className="border-t pt-4 flex justify-between font-bold text-base text-foreground">
                  <span>Grand Total (incl. GST)</span>
                  <span>{formatPrice(selectedOrder.amount)}</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="sticky top-24 bg-secondary/10 border-dashed border-2">
              <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center">
                <Info className="h-8 w-8 mb-2 text-muted-foreground" />
                <p className="text-sm">Select an order row from the table to view delivery cargo details and itemized invoices.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
