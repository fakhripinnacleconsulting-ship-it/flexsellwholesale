"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Printer, ArrowRight, ShoppingBag, MapPin, ClipboardList, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { orderService } from "@/services/orderService";
import { Order } from "@/types";
import { formatPrice } from "@/lib/utils";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";

  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [invoice, setInvoice] = React.useState<any>(null);

  React.useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        const fetched = await orderService.getOrderById(orderId);
        setOrder(fetched);
      } catch (err: unknown) {
        setError((err as any).message || "Failed to load order confirmation details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // Fetch CMS settings for seller details
    fetch("/api/cms")
      .then(res => res.json())
      .then(data => setCmsData(data))
      .catch(err => console.error("Failed to load CMS data:", err));

    // Fetch original invoice matching this order ID
    fetch(`/api/invoices?orderId=${orderId}`)
      .then(res => res.json())
      .then(data => {
        const invs = Array.isArray(data) ? data : data.invoices || [];
        if (invs.length > 0) {
          setInvoice(invs[0]);
        }
      })
      .catch(err => console.error("Failed to load invoice:", err));
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-primary border-r-2"></div>
          <p className="text-sm font-semibold text-muted-foreground">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
        <Card className="max-w-md w-full border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              Order Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {error || "We couldn't retrieve the details for order ID: " + orderId}
            </p>
            <Link href="/products" className="block">
              <Button className="w-full">Continue Sourcing</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 text-foreground w-full print:bg-white print:text-black">
      {/* Screen layout */}
      <div className="max-w-3xl mx-auto space-y-8 print:hidden">
        
        {/* Success Header Card */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-500 rounded-full animate-bounce">
            <CheckCircle className="h-16 w-16" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">Order Confirmed!</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Thank you for sourcing with FlexSell. Your B2B order has been generated and queued for wholesale fulfillment.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={handlePrint} variant="outline" className="flex items-center gap-2 font-semibold">
              <Printer className="h-4 w-4" /> Print Purchase Invoice
            </Button>
            <Link href="/products">
              <Button className="flex items-center gap-2 font-semibold">
                <ShoppingBag className="h-4 w-4" /> Continue Sourcing
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Order Summary */}
          <Card className="md:col-span-2 border-border/60 shadow-sm">
            <CardHeader className="border-b bg-secondary/10">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" /> Order Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Order Reference</span>
                  <span className="font-mono font-bold text-foreground text-base">{order._id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Order Date</span>
                  <span className="font-semibold text-foreground">{order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Payment Term</span>
                  <span className="font-semibold text-emerald-600">Pending Cargo Verification</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Fulfillment Status</span>
                  <span className="font-semibold text-primary">{order.status || "Processing"}</span>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="border-t pt-4">
                <h3 className="font-bold text-sm mb-3">Sourced Products & Packaging</h3>
                <div className="space-y-3">
                  {order.items.map((item) => {
                    const formattedVariants = Object.entries(item.selectedVariants)
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(" • ");
                    return (
                      <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-border/40 last:border-b-0">
                        <div>
                          <p className="font-semibold text-foreground">{item.product.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formattedVariants}</p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p className="font-bold">{item.quantity} x {formatPrice(item.pricePerUnit)}</p>
                          <p className="text-[10px] text-muted-foreground">GST Incl.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Final Amount */}
              <div className="border-t pt-4 flex justify-between items-center font-bold text-lg text-foreground">
                <span>Total Amount Sourced (Incl. GST)</span>
                <span className="text-primary text-xl">{formatPrice(order.amount)}</span>
              </div>

            </CardContent>
          </Card>

          {/* Shipping details */}
          <div className="space-y-6">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="border-b bg-secondary/10">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" /> Delivery Dock
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-sm space-y-3 text-foreground">
                <p className="font-bold">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                {order.shippingAddress.company && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{order.shippingAddress.company}</p>
                )}
                <p className="text-muted-foreground leading-relaxed">
                  {order.shippingAddress.address}
                  {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}<br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
                </p>
                <p className="text-xs font-mono text-muted-foreground pt-2 border-t">
                  Phone: {order.shippingAddress.phone}<br />
                  Email: {order.shippingAddress.email}
                </p>
                {order.shippingAddress.gstin && (
                  <p className="text-xs font-mono bg-secondary/30 p-2 rounded border text-foreground mt-2">
                    GSTIN: {order.shippingAddress.gstin}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-primary/5 shadow-sm">
              <CardContent className="p-4 text-center space-y-3">
                <ShieldCheck className="h-8 w-8 text-primary mx-auto" />
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Buyer Protection</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This transaction is secured under wholesale trade guidelines. Inspect packages upon arrival at dock.
                </p>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Back Link */}
        <div className="text-center">
          <Link href="/client/orders" className="text-sm font-semibold text-muted-foreground hover:text-primary inline-flex items-center gap-2 transition-colors">
            Go to My Purchase Orders Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

      {/* Print only original generated invoice or receipt */}
      <div className="hidden print:block max-w-4xl mx-auto p-4">
        <InvoiceDocument
          type={invoice?.type || (order.paymentStatus === "Paid" ? "invoice" : "receipt")}
          documentNumber={invoice?._id || `RCP-${order._id.replace("ORD-", "")}`}
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
      </div>
    </div>
  );
}
