"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useOrderStore, Order } from "@/stores/orderStore";
import { useToastStore } from "@/stores/toastStore";
import { shiprocketService } from "@/services/shiprocketService";
import { formatPrice } from "@/lib/utils";
import {
  Rocket,
  Search,
  RefreshCw,
  FileText,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Truck,
  Clock,
  ChevronRight
} from "lucide-react";
import { ShippingLabelDocument } from "@/components/documents/ShippingLabelDocument";

export function ShiprocketTable() {
  const { orders, initializeOrders } = useOrderStore();
  const { addToast } = useToastStore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [isLoading, setIsLoading] = React.useState(false);

  // Modal states
  const [selectedTrackingOrder, setSelectedTrackingOrder] = React.useState<Order | null>(null);
  const [selectedLabelOrder, setSelectedLabelOrder] = React.useState<Order | null>(null);
  const [liveTrackingData, setLiveTrackingData] = React.useState<any>(null);
  const [isLoadingTracking, setIsLoadingTracking] = React.useState(false);

  React.useEffect(() => {
    initializeOrders();
  }, [initializeOrders]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await initializeOrders();
      addToast("Order shipments refreshed.", "info");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter orders that have shiprocket details OR are ready for shiprocket fulfillment
  const shiprocketOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const isSr = o.shipmentDetails?.type === "shiprocket" || Boolean(o.shipmentDetails?.shiprocket?.orderId);
      const matchesTerm =
        !searchTerm ||
        o._id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.shipmentDetails?.shiprocket?.awbCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.shipmentDetails?.shiprocket?.courierName?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesTerm) return false;

      if (statusFilter === "all") return isSr;
      if (statusFilter === "stalled") return Boolean(o.shipmentDetails?.shiprocket?.failedAt);
      if (statusFilter === "in_transit") return o.status === "In Transit";
      if (statusFilter === "awaiting") return o.status === "Awaiting Shipment";
      if (statusFilter === "delivered") return o.status === "Delivered";
      if (statusFilter === "cancelled") return o.status === "Cancelled";

      return isSr;
    });
  }, [orders, searchTerm, statusFilter]);

  // Action Handlers
  const handleDownloadLabel = async (order: Order) => {
    if (order.shipmentDetails?.type === "shiprocket") {
      try {
        const res: any = await shiprocketService.getLabelUrl(order._id);
        if (res?.labelUrl) {
          window.open(res.labelUrl, "_blank");
          return;
        }
      } catch (err: any) {
        // Fallback to in-house printable label
      }
    }
    setSelectedLabelOrder(order);
  };

  const handleRetryStep = async (orderId: string) => {
    setIsLoading(true);
    try {
      const res: any = await shiprocketService.retryFulfillment(orderId);
      if (res.success) {
        addToast("Fulfillment step retried successfully!", "success");
        await initializeOrders();
      } else {
        addToast(res.error || "Retry failed", "error");
      }
    } catch (err: any) {
      addToast(err.message || "Retry request failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelShipment = async (orderId: string) => {
    if (!confirm(`Are you sure you want to cancel the Shiprocket booking for order ${orderId}?`)) return;
    setIsLoading(true);
    try {
      await shiprocketService.cancelShiprocketOrder(orderId);
      addToast("Shiprocket shipment cancelled successfully.", "success");
      await initializeOrders();
    } catch (err: any) {
      addToast(err.message || "Failed to cancel shipment", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLiveTracking = async (order: Order) => {
    setSelectedTrackingOrder(order);
    setIsLoadingTracking(true);
    setLiveTrackingData(null);
    try {
      const res: any = await shiprocketService.getTracking(order._id);
      setLiveTrackingData(res.liveTracking || null);
    } catch (err: any) {
      addToast(err.message || "Failed to load live tracking", "error");
    } finally {
      setIsLoadingTracking(false);
    }
  };

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 border-b">
        <div>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
            <Rocket className="h-5 w-5" /> Shiprocket Logistics Operations Table
          </CardTitle>
          <CardDescription className="text-xs">
            Manage live AWBs, label downloads, tracking timelines, and retry stalled bookings.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="font-bold flex items-center gap-1.5 text-xs cursor-pointer">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Table
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Search & Status Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Order ID, AWB, Carrier, Customer..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted-foreground font-semibold shrink-0">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background text-foreground text-xs font-semibold px-3 py-1.5 border rounded-md cursor-pointer h-9 w-full sm:w-auto"
            >
              <option value="all">All Shiprocket Shipments</option>
              <option value="awaiting">Awaiting Shipment</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="stalled">⚠ Stalled / Failed Steps</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Tabular View */}
        <div className="overflow-x-auto border rounded-lg bg-card">
          <table className="w-full text-xs text-left">
            <thead className="bg-secondary/40 text-[11px] uppercase font-bold text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3">Order Ref</th>
                <th className="px-4 py-3">Customer & Pincode</th>
                <th className="px-4 py-3">Carrier Partner</th>
                <th className="px-4 py-3">AWB / Tracking Code</th>
                <th className="px-4 py-3">Logistics Status</th>
                <th className="px-4 py-3">Fulfillment Step</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shiprocketOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No Shiprocket shipments found matching the selected filter.
                  </td>
                </tr>
              ) : (
                shiprocketOrders.map((order) => {
                  const sr = order.shipmentDetails?.shiprocket;
                  const isStalled = Boolean(sr?.failedAt);
                  const awb = sr?.awbCode || order.shipmentDetails?.trackingId || "N/A";
                  const carrier = sr?.courierName || order.shipmentDetails?.carrierName || "Shiprocket Partner";

                  return (
                    <tr key={order._id} className="hover:bg-secondary/10 transition-colors">
                      {/* Order Ref */}
                      <td className="px-4 py-3 font-mono">
                        <span className="font-bold text-foreground block">{order._id}</span>
                        <span className="text-[10px] text-muted-foreground">{order.date}</span>
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-foreground block">{order.customerName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">Pin: {order.shippingAddress.pinCode}</span>
                      </td>

                      {/* Carrier */}
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {carrier}
                      </td>

                      {/* AWB Code */}
                      <td className="px-4 py-3 font-mono">
                        {awb !== "N/A" ? (
                          <span className="bg-secondary/40 px-2 py-0.5 rounded font-bold text-foreground inline-block">
                            {awb}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Pending AWB</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          order.status === "Delivered" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                          order.status === "In Transit" ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400" :
                          order.status === "Awaiting Shipment" ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" :
                          order.status === "Cancelled" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>
                          {sr?.currentStatus || order.status}
                        </span>
                      </td>

                      {/* Fulfillment Step / Stalled Warning */}
                      <td className="px-4 py-3">
                        {isStalled ? (
                          <div className="text-destructive font-bold flex items-center gap-1 text-[11px]">
                            <AlertTriangle className="h-3.5 w-3.5" /> Stalled: {sr?.failedAt}
                          </div>
                        ) : (
                          <span className="text-muted-foreground capitalize text-[11px] font-medium">
                            {sr?.fulfillmentStep || "Complete"}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Stalled Retry */}
                          {isStalled && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRetryStep(order._id)}
                              className="h-7 text-[10px] font-bold px-2 flex items-center gap-1 cursor-pointer"
                              title="Retry failed fulfillment step"
                            >
                              <RotateCcw className="h-3 w-3" /> Retry
                            </Button>
                          )}

                          {/* Download Label */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadLabel(order)}
                            className="h-7 text-[10px] font-bold px-2 border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1 cursor-pointer"
                            title="Download / Print Shipping Label"
                          >
                            <FileText className="h-3 w-3" /> Label
                          </Button>

                          {/* Live Track */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenLiveTracking(order)}
                            className="h-7 text-[10px] font-bold px-2 flex items-center gap-1 cursor-pointer"
                            title="View Live Tracking Activities"
                          >
                            <Truck className="h-3 w-3" /> Track
                          </Button>

                          {/* Cancel */}
                          {order.status !== "Delivered" && order.status !== "Cancelled" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelShipment(order._id)}
                              className="h-7 text-[10px] text-destructive hover:bg-destructive/10 px-1.5 cursor-pointer"
                              title="Cancel Shiprocket Booking"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Live Tracking Activity Modal */}
      {selectedTrackingOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-primary">
                  <Truck className="h-4.5 w-4.5" /> Live Shiprocket Tracking Timeline
                </h3>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Order ID: {selectedTrackingOrder._id}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTrackingOrder(null)} className="h-7 text-xs">
                Close
              </Button>
            </div>

            {isLoadingTracking ? (
              <div className="flex items-center gap-2 justify-center py-8 text-xs text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" /> Fetching live carrier telemetry...
              </div>
            ) : liveTrackingData ? (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-primary/5 border rounded-lg space-y-1">
                  <span className="text-muted-foreground block text-[10px]">CURRENT CARRIER STATUS</span>
                  <span className="font-bold text-primary text-sm uppercase">{liveTrackingData.shipment_status || "IN TRANSIT"}</span>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Carrier Activity Logs</h4>
                  <div className="relative pl-4 border-l border-primary/30 space-y-3">
                    {liveTrackingData.shipment_track_activities && Array.isArray(liveTrackingData.shipment_track_activities) ? (
                      liveTrackingData.shipment_track_activities.map((act: any, i: number) => (
                        <div key={i} className="relative space-y-0.5">
                          <div className="absolute -left-[20.5px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div className="flex justify-between font-bold text-foreground">
                            <span>{act.activity}</span>
                            <span className="text-[10px] text-muted-foreground">{act.date}</span>
                          </div>
                          {act.location && <p className="text-[11px] text-muted-foreground">Location: {act.location}</p>}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-xs">No activity checkpoints logged yet by carrier.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No active tracking timeline returned from Shiprocket API yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipping Label Preview Modal */}
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
