"use client";

import * as React from "react";
import Link from "next/link";
import { useOrderStore } from "@/stores/orderStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, Printer, Truck, Calendar, CheckCircle, Clock, AlertTriangle, FileText, Check, MapPin, Ban, RotateCcw } from "lucide-react";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { SellerInfo } from "@/types";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";
import { buildSellerInfo } from "@/lib/buildSellerInfo";
import { orderService } from "@/services/orderService";
import { useToastStore } from "@/stores/toastStore";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useRouter } from "next/navigation";

const CUSTOMER_CANCELLABLE_STATUSES = ["Placed", "Pending", "Confirmed"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientOrderDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  const orderId = resolvedParams.id;
  const router = useRouter();

  const { orders, initializeOrders, isLoading } = useOrderStore();
  const { addToast } = useToastStore();
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [invoice, setInvoice] = React.useState<any>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);

  React.useEffect(() => {
    initializeOrders();
    fetch("/api/cms")
      .then(res => res.json())
      .then(data => setCmsData(data))
      .catch(err => console.error("Failed to load CMS data:", err));

    fetch(`/api/invoices?orderId=${orderId}`)
      .then(res => res.json())
      .then(data => {
        const invs = Array.isArray(data) ? data : data.invoices || [];
        if (invs.length > 0) {
          setInvoice(invs[0]);
        }
      })
      .catch(err => console.error("Failed to load invoice:", err));
  }, [initializeOrders, orderId]);

  const order = React.useMemo(() => orders.find(o => o._id === orderId), [orders, orderId]);

  const handlePrint = () => {
    const docLabel = invoice?.type === "receipt" ? "RECEIPT" : invoice?.type === "quote" ? "Quote" : "Invoice";
    triggerPrintWithTitle(docLabel, orderId, order?.customerName);
  };

  const handleCancelOrder = async () => {
    if (!confirm("Are you sure you want to cancel this order? This cannot be undone.")) return;
    setIsCancelling(true);
    try {
      await orderService.cancelOrder(orderId);
      addToast("Order cancelled successfully.", "success");
      await initializeOrders();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to cancel order", "error");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    setIsReordering(true);
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
      setIsReordering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Loading Order Invoice...</h2>
        <p className="text-muted-foreground">Retrieving order status information.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-4">The order specified could not be located in your account ledger.</p>
        <Link href="/client/orders">
          <Button variant="outline">Back to Order History</Button>
        </Link>
      </div>
    );
  }

  const isShiprocket = order.shipmentDetails?.type === "shiprocket";
  const steps = isShiprocket
    ? ["Placed", "Processing", "Awaiting Shipment", "In Transit", "Delivered"]
    : ["Placed", "Processing", "Shipped", "Delivered"];
  const currentStepIdx = steps.indexOf(order.status);
  const isCancelled = order.status === "Cancelled";

  return (
    <div className="container mx-auto px-4 py-8 space-y-6 text-foreground">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/client/orders">
              <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Order #{order._id}</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              order.status === "Delivered" ? "bg-green-100 text-green-800" :
              order.status === "Shipped" || order.status === "In Transit" ? "bg-blue-100 text-blue-800" :
              order.status === "Cancelled" ? "bg-red-100 text-red-800" :
              "bg-yellow-100 text-yellow-800"
            }`}>
              {order.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Placed on {order.date}</p>
        </div>

        <div className="flex items-center gap-2">
          {CUSTOMER_CANCELLABLE_STATUSES.includes(order.status) && (
            <Button
              onClick={handleCancelOrder}
              disabled={isCancelling}
              variant="outline"
              size="sm"
              className="font-bold flex items-center gap-1 shadow-sm text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Ban className="h-4 w-4" /> {isCancelling ? "Cancelling..." : "Cancel Order"}
            </Button>
          )}
          <Button onClick={handleReorder} disabled={isReordering} variant="outline" size="sm" className="font-bold flex items-center gap-1 shadow-sm">
            <RotateCcw className="h-4 w-4" /> {isReordering ? "Adding..." : "Buy Again"}
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm" className="font-bold flex items-center gap-1 shadow-sm">
            <Printer className="h-4 w-4" /> Print Commercial Invoice
          </Button>
        </div>
      </div>

      {/* Grid: Stepper & Delivery Address */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        <Card className="lg:col-span-2 border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Fulfillment Status Tracker</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!isCancelled ? (
              <div className="relative flex justify-between items-center max-w-md mx-auto my-4">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-0" />
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary transition-all duration-500 -z-0" 
                  style={{ width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, idx) => {
                  const isActive = idx <= currentStepIdx;
                  return (
                    <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5">
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
                        isActive ? "border-primary bg-primary text-primary-foreground font-bold" : "border-muted bg-background text-muted-foreground"
                      }`}>
                        <span className="text-xs">{idx + 1}</span>
                      </div>
                      <span className={`text-[10px] font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-xs font-bold text-destructive">
                This order has been cancelled. If you believe this is an error, please reach out to customer support.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Delivery Dock Address
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 text-xs space-y-1">
            <p className="font-bold text-foreground text-sm">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
            {order.shippingAddress.company && <p className="font-semibold text-muted-foreground">{order.shippingAddress.company}</p>}
            <p>{order.shippingAddress.address}{order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}</p>
            <p className="font-mono pt-1 text-muted-foreground">Ph: {order.shippingAddress.phone}</p>
            {order.shippingAddress.gstin && <p className="font-mono text-primary font-bold">GSTIN: {order.shippingAddress.gstin}</p>}
          </CardContent>
        </Card>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start print:block">
        {/* Left Column: Commercial Invoice */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border print:border-none print:shadow-none">
            <CardContent className="p-6">
              <InvoiceDocument
                type={invoice?.type || (order.paymentStatus === "Paid" ? "invoice" : "receipt")}
                documentNumber={invoice?._id || "DRAFT-PREVIEW"}
                order={order}
                customerId={invoice?.customerId}
                sellerInfo={buildSellerInfo(cmsData)}
                showActions={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tracking Details */}
        <div className="space-y-6 print:hidden">
          {order.shipmentDetails ? (
            <Card className="border border-primary/25 bg-primary/5 shadow-sm">
              <CardHeader className="pb-3 border-b border-primary/10">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Truck className="h-4.5 w-4.5" /> Shipment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="space-y-2.5">
                  <div>
                    <span className="text-muted-foreground">Dispatch Method:</span>
                    <p className="font-bold capitalize mt-0.5">
                      {order.shipmentDetails.type === "shiprocket" ? "🚀 Shiprocket Express API" : order.shipmentDetails.type === "self" ? "FlexSell Transport (Self)" : "Third-Party Courier"}
                    </p>
                  </div>
                  {(order.shipmentDetails.carrierName || order.shipmentDetails.shiprocket?.courierName) && (
                    <div>
                      <span className="text-muted-foreground">Carrier:</span>
                      <p className="font-bold">{order.shipmentDetails.shiprocket?.courierName || order.shipmentDetails.carrierName}</p>
                    </div>
                  )}
                  <div className="border-t pt-2">
                    <span className="text-muted-foreground">Tracking Reference / AWB:</span>
                    <p className="font-mono font-bold mt-1 text-foreground bg-secondary/45 px-2 py-0.5 rounded inline-block">
                      {order.shipmentDetails.shiprocket?.awbCode || order.shipmentDetails.trackingId}
                    </p>
                  </div>
                  {order.shipmentDetails.trackingUrl && (
                    <div className="border-t pt-2">
                      <span className="text-muted-foreground">Live Tracking Webpage:</span>
                      <p className="mt-1">
                        <a href={order.shipmentDetails.trackingUrl} target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline break-all">
                          Click here to track shipment
                        </a>
                      </p>
                    </div>
                  )}
                  {order.shipmentDetails.estimatedDelivery && (
                    <div className="border-t pt-2">
                      <span className="text-muted-foreground">Estimated Delivery Date:</span>
                      <p className="font-bold mt-1 text-primary flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" /> {order.shipmentDetails.estimatedDelivery}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border bg-secondary/5 no-print">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Dispatch Pending
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                This order is packed and awaiting hand-over to the carrier. Tracking credentials will appear here once dispatched.
              </CardContent>
            </Card>
          )}

          {/* Timeline History log */}
          <Card className="border border-border">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Clock className="h-4 w-4" /> Shipment Timeline Log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative pl-4 border-l border-border space-y-5 ml-1 text-xs">
                {order.history && order.history.map((ev, i) => (
                  <div key={i} className="relative space-y-1">
                    <div className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 bg-background ${ev.status === "Delivered" ? "border-green-600 bg-green-600" :
                        ev.status === "Shipped" ? "border-primary bg-primary" :
                          ev.status === "Cancelled" ? "border-destructive bg-destructive" :
                            "border-yellow-500 bg-yellow-500"
                      }`} />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{ev.status}</span>
                      <span className="text-[10px] text-muted-foreground">{ev.timestamp}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ev.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
