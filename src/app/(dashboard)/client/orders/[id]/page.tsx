"use client";

import * as React from "react";
import Link from "next/link";
import { useOrderStore } from "@/stores/orderStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, Printer, Truck, Calendar, CheckCircle, Clock, AlertTriangle, FileText, Check } from "lucide-react";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { SellerInfo } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientOrderDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  const orderId = resolvedParams.id;

  const { orders, initializeOrders, isLoading } = useOrderStore();
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [invoice, setInvoice] = React.useState<any>(null);

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

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Loading Order Invoice...</h2>
        <p className="text-muted-foreground">Retrieving cargo status information.</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
        <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground mb-6">We couldn't find any order matching ID "{orderId}".</p>
        <Link href="/client/orders">
          <Button><ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders</Button>
        </Link>
      </div>
    );
  }

  // Determine active steps for horizontal stepper [UPDATED-4]
  const isShiprocket = order.shipmentDetails?.type === "shiprocket";
  const steps = isShiprocket
    ? ["Placed", "Processing", "Awaiting Shipment", "In Transit", "Delivered"]
    : ["Placed", "Processing", "Shipped", "Delivered"];
  const currentStepIdx = steps.indexOf(order.status);
  const isCancelled = order.status === "Cancelled";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-5xl">
      {/* Back Bar */}
      <div className="flex justify-between items-center no-print">
        <Link href="/client/orders">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Orders
          </Button>
        </Link>
        <Button onClick={handlePrint} variant="outline" className="font-bold flex items-center gap-1.5 shadow-sm">
          <Printer className="h-4 w-4" /> Print Commercial Invoice
        </Button>
      </div>

      {/* Visual Stepper Tracker */}
      {!isCancelled ? (
        <Card className="border border-border p-6 bg-card shadow-sm no-print">
          <div className="relative flex justify-between items-center max-w-3xl mx-auto">
            {/* Connection Line */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-0" />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary transition-all duration-500 -z-0" 
              style={{ width: `${(Math.max(0, currentStepIdx) / (steps.length - 1)) * 100}%` }}
            />

            {steps.map((step, idx) => {
              const isActive = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={idx} className="relative z-10 flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isActive 
                      ? "border-primary bg-primary text-primary-foreground font-bold shadow-md" 
                      : "border-muted bg-background text-muted-foreground"
                  } ${isCurrent ? "ring-4 ring-primary/20 scale-110" : ""}`}>
                    {isActive && idx < currentStepIdx ? (
                      <Check className="h-4 w-4 stroke-[3]" />
                    ) : (
                      <span className="text-xs">{idx + 1}</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="border border-destructive/25 p-4 bg-destructive/5 flex items-center gap-3 no-print">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-xs font-bold text-destructive">
            This order has been Cancelled. If you have questions, please reach out to wholesale B2B support.
          </p>
        </Card>
      )}

      {/* Order details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Items details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border">
            <CardContent className="p-6">
              <InvoiceDocument
                type={invoice?.type || (order.paymentStatus === "Paid" ? "invoice" : "receipt")}
                documentNumber={invoice?._id || "DRAFT-PREVIEW"}
                order={order}
                customerId={invoice?.customerId}
                sellerInfo={{
                  storeName: cmsData?.brandSettings?.storeName || "FlexSell Wholesale",
                  gstin: cmsData?.brandSettings?.gstin || "24AAACF1001M1Z5",
                  address: cmsData?.brandSettings?.companyAddress || "Plot No. 12, GIDC Industrial Estate, Sachin, Surat, Gujarat - 394230",
                  email: cmsData?.brandSettings?.supportEmail || "support@flexsell.in",
                  phone: cmsData?.brandSettings?.supportPhone || "+91 261 2409000",
                }}
                showActions={false}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tracking Details */}
        <div className="space-y-6">
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
                      {order.shipmentDetails.type === "shiprocket" ? "🚀 Shiprocket Cargo API" : order.shipmentDetails.type === "self" ? "FlexSell Cargo (Self)" : "Third-Party Courier"}
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
                    <div className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 bg-background ${
                      ev.status === "Delivered" ? "border-green-600 bg-green-600" :
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
