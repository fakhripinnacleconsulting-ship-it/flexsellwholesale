"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Package, Clock, Truck, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useOrderStore } from "@/stores/orderStore";
import { customerService } from "@/services/customerService";
import { Customer } from "@/types";
import { formatPrice } from "@/lib/utils";

export default function ClientDashboardPage() {
  const { orders, initializeOrders } = useOrderStore();
  const [activeCustomer, setActiveCustomer] = React.useState<Customer | null>(null);

  React.useEffect(() => {
    initializeOrders();
    customerService.getActiveCustomer().then(setActiveCustomer).catch(console.error);
  }, [initializeOrders]);

  // Filter orders by active customer's email and active dashboard view
  const { useDashboardViewStore } = require("@/stores/dashboardViewStore");
  const { activeView } = useDashboardViewStore();

  const customerOrders = React.useMemo(() => {
    if (!activeCustomer) return [];
    
    const matchedOrders = orders.filter(
      (o) => o.shippingAddress.email.toLowerCase() === activeCustomer.email.toLowerCase()
    );

    return matchedOrders.filter(o => {
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
  }, [orders, activeCustomer, activeView]);

  // Compute live stats
  const totalCount = customerOrders.length;
  const pendingCount = customerOrders.filter((o) => o.status === "Processing").length;
  const shippedCount = customerOrders.filter((o) => o.status === "Shipped").length;
  const deliveredCount = customerOrders.filter((o) => o.status === "Delivered").length;

  // Get recent 5 orders
  const recentOrders = React.useMemo(() => {
    return customerOrders.slice(0, 5);
  }, [customerOrders]);

  if (!activeCustomer) {
    return <div className="text-center py-10 text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground mt-1">Hello, {activeCustomer.name} ({activeCustomer.company})</p>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full text-blue-600 dark:text-blue-400">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Orders</p>
              <h3 className="text-2xl font-black mt-0.5">{totalCount}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-full text-yellow-600 dark:text-yellow-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending</p>
              <h3 className="text-2xl font-black mt-0.5">{pendingCount}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full text-purple-600 dark:text-purple-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shipped</p>
              <h3 className="text-2xl font-black mt-0.5">{shippedCount}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delivered</p>
              <h3 className="text-2xl font-black mt-0.5">{deliveredCount}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <CardTitle className="text-lg font-bold">Recent Wholesale Consignments</CardTitle>
          <Link href="/client/orders" className="text-xs text-primary hover:underline font-bold flex items-center gap-1">
            View All Orders <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b">
                <tr>
                  <th className="px-6 py-3.5">Order ID</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Total Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground italic">
                      No order records found for your account.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-6 py-4 font-bold">{order._id}</td>
                      <td className="px-6 py-4 text-muted-foreground">{order.date}</td>
                      <td className="px-6 py-4 font-bold">{formatPrice(order.amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${order.statusClass}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/client/orders/${order._id}`}>
                          <Button variant="outline" size="sm" className="font-semibold">
                            Track Order
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
