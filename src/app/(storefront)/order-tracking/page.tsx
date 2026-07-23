"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useOrderStore, Order } from "@/stores/orderStore";
import { PackageSearch, ArrowLeft, Truck, Calendar, Clock, AlertTriangle, Check, Search } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export default function OrderTrackingPage() {
  const { orders, initializeOrders } = useOrderStore();
  const [orderId, setOrderId] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [trackedOrder, setTrackedOrder] = React.useState<Order | null>(null);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [hasSearched, setHasSearched] = React.useState(false);

  React.useEffect(() => {
    initializeOrders();
  }, [initializeOrders]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setHasSearched(true);

    const cleanedId = orderId.trim().toUpperCase();
    const cleanedEmail = email.trim().toLowerCase();

    if (!cleanedId || !cleanedEmail) {
      setErrorMsg("Please provide both the Order ID and Billing Email.");
      return;
    }

    const matched = orders.find(o => 
      o._id.toUpperCase() === cleanedId && 
      o.shippingAddress.email.toLowerCase() === cleanedEmail
    );

    if (matched) {
      setTrackedOrder(matched);
    } else {
      setTrackedOrder(null);
      setErrorMsg("No matching order found. Please verify your Order ID and Billing Email address.");
    }
  };

  const handleReset = () => {
    setOrderId("");
    setEmail("");
    setTrackedOrder(null);
    setErrorMsg("");
    setHasSearched(false);
  };

  // Determine active steps for stepper [UPDATED-4]
  const isShiprocket = trackedOrder?.shipmentDetails?.type === "shiprocket";
  const steps = isShiprocket
    ? ["Placed", "Processing", "Awaiting Shipment", "In Transit", "Delivered"]
    : ["Placed", "Processing", "Shipped", "Delivered"];
  const currentStepIdx = trackedOrder ? steps.indexOf(trackedOrder.status) : -1;
  const isCancelled = trackedOrder?.status === "Cancelled";

  return (
    <div className="container mx-auto px-4 py-16 flex justify-center text-foreground min-h-[70vh]">
      <div className="w-full max-w-2xl">
        {!trackedOrder ? (
          /* Search Form Card */
          <Card className="shadow-md border border-border">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center shadow-inner">
                <PackageSearch className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black uppercase tracking-tight">Track Your B2B Cargo</CardTitle>
              <CardDescription>Enter your Order ID and company email address to track real-time logistics dispatch statuses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleTrack} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order Ref ID:</label>
                  <Input 
                    placeholder="e.g. FS-10025" 
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    className="text-foreground text-sm font-semibold"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing Email Address:</label>
                  <Input 
                    type="email" 
                    placeholder="e.g. buyer@company.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-foreground text-sm"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-lg flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> {errorMsg}
                  </div>
                )}
                
                <Button type="submit" className="w-full mt-2 font-bold flex items-center justify-center gap-1.5" size="lg">
                  <Search className="h-4.5 w-4.5" /> Track Shipment
                </Button>
              </form>

              <div className="p-4 bg-primary/5 border border-primary/15 rounded-lg text-xs text-muted-foreground">
                <p className="font-bold text-foreground mb-1">Where do I find my credentials?</p>
                <p className="leading-relaxed">Your Order ID was sent to your registered email address during B2B checkout. You can also view active order IDs in your Client Dashboard under the "Order History" log.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Live Tracking Detail View */
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" /> Track another shipment
              </Button>
              <span className="text-xs font-mono font-bold text-muted-foreground">Order ID: {trackedOrder._id}</span>
            </div>

            {/* Stepper tracker */}
            {!isCancelled ? (
              <Card className="border p-6 bg-card shadow-sm">
                <div className="relative flex justify-between items-center max-w-lg mx-auto">
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
                            ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm" 
                            : "border-muted bg-background text-muted-foreground"
                        } ${isCurrent ? "ring-4 ring-primary/20 scale-110" : ""}`}>
                          {isActive && idx < currentStepIdx ? (
                            <Check className="h-4 w-4 stroke-[3]" />
                          ) : (
                            <span className="text-xs">{idx + 1}</span>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="border border-destructive/20 p-4 bg-destructive/5 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-xs font-bold text-destructive">
                  This order has been Cancelled. Please check with wholesale support for more information.
                </p>
              </Card>
            )}

            {/* Shipment tracking details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Left Panel: Tracking Card */}
              {trackedOrder.shipmentDetails ? (
                <Card className="border border-primary/20 bg-primary/5 flex flex-col justify-between">
                  <CardHeader className="pb-2 border-b border-primary/10">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Truck className="h-4.5 w-4.5" /> Shipment Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4 text-xs flex-1">
                    <div className="space-y-3">
                      <div>
                        <span className="text-muted-foreground">Logistics Type:</span>
                        <p className="font-bold capitalize mt-0.5">
                          {trackedOrder.shipmentDetails.type === "shiprocket" ? "🚀 Shiprocket Cargo API" : trackedOrder.shipmentDetails.type === "self" ? "FlexSell Cargo (Self)" : "Third-Party Courier"}
                        </p>
                      </div>
                      {(trackedOrder.shipmentDetails.carrierName || trackedOrder.shipmentDetails.shiprocket?.courierName) && (
                        <div>
                          <span className="text-muted-foreground">Carrier Provider:</span>
                          <p className="font-bold">{trackedOrder.shipmentDetails.shiprocket?.courierName || trackedOrder.shipmentDetails.carrierName}</p>
                        </div>
                      )}
                      <div className="border-t pt-2">
                        <span className="text-muted-foreground">Tracking ID / AWB:</span>
                        <p className="font-mono font-bold mt-1 text-foreground bg-secondary/45 px-2 py-0.5 rounded inline-block">
                          {trackedOrder.shipmentDetails.shiprocket?.awbCode || trackedOrder.shipmentDetails.trackingId}
                        </p>
                      </div>
                      {trackedOrder.shipmentDetails.trackingUrl && (
                        <div className="border-t pt-2">
                          <span className="text-muted-foreground">Tracking Link:</span>
                          <p className="mt-1">
                            <a href={trackedOrder.shipmentDetails.trackingUrl} target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline break-all">
                              Click here to track courier dispatch
                            </a>
                          </p>
                        </div>
                      )}
                      {trackedOrder.shipmentDetails.estimatedDelivery && (
                        <div className="border-t pt-2">
                          <span className="text-muted-foreground">Estimated Delivery:</span>
                          <p className="font-bold mt-1 text-primary flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" /> {trackedOrder.shipmentDetails.estimatedDelivery}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border border-border bg-secondary/5 flex flex-col justify-center items-center py-10">
                  <Clock className="h-8 w-8 text-muted-foreground/60 mb-2 animate-spin-slow" />
                  <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Fulfillment Pending</h4>
                  <p className="text-[11px] text-muted-foreground mt-1 text-center px-6">Your order is being packaged. Once dispatched, tracking credentials will be shared here.</p>
                </Card>
              )}

              {/* Right Panel: Stepper Log */}
              <Card className="border border-border">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" /> Dispatch History
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 max-h-[300px] overflow-y-auto">
                  <div className="relative pl-4 border-l border-border space-y-4 ml-1 text-xs">
                    {trackedOrder.history && trackedOrder.history.map((ev, i) => (
                      <div key={i} className="relative space-y-0.5">
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

            {/* Bottom summary card */}
            <Card className="border border-border">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                <div className="text-left">
                  <p className="font-bold text-foreground">B2B Consignment Invoice Summary</p>
                  <p className="text-muted-foreground mt-0.5">{trackedOrder.itemsCount} total units packed in this shipment.</p>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-muted-foreground">Grand Total (incl. GST):</p>
                  <p className="text-base font-black text-primary">{formatPrice(trackedOrder.amount)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
