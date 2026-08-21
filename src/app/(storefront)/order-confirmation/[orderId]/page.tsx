"use client";
import { formatDateIST } from "@/lib/datetime";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Printer, ArrowRight, ShoppingBag, MapPin, ClipboardList, ShieldCheck, CreditCard } from "lucide-react";
import { openRazorpayCheckout } from "@/lib/razorpayLoader";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { orderService } from "@/services/orderService";
import { invoiceService } from "@/services/invoiceService";
import { Order } from "@/types";
import { formatPrice } from "@/lib/utils";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";
import { buildSellerInfo } from "@/lib/buildSellerInfo";
import { useAuthStore } from "@/stores/authStore";
import * as advanceBalanceService from "@/services/advanceBalanceService";

export default function OrderConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = typeof params?.orderId === "string" ? params.orderId : "";

  const [order, setOrder] = React.useState<Order | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [invoice, setInvoice] = React.useState<any>(null);
  const [paying, setPaying] = React.useState(false);
  const { addToast } = useToastStore();
  const currentUser = useAuthStore((state: any) => state.customer);

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

    /**
     * Through the service, which knows that a settled order has **two** documents — the
     * retained `REC-` receipt and the `INV-` Tax Invoice issued against it — and returns the
     * invoice. The raw fetch this replaces took `[0]` of the list, so a buyer could be shown
     * a pending receipt for an order they had already paid.
     */
    invoiceService
      .getInvoiceByOrderId(orderId)
      .then((doc) => {
        if (doc) setInvoice(doc);
      })
      .catch(err => console.error("Failed to load invoice:", err));
  }, [orderId]);

  // An order can legitimately sit here unpaid — an admin-converted Razorpay quote, or a
  // checkout whose stock release failed. Without this the buyer has no way to pay it.
  const needsPayment =
    !!order && ["Razorpay", "Wallet"].includes(order.paymentMethod || "") && order.paymentStatus !== "Paid" && order.status !== "Cancelled";

  const handleCompletePayment = async () => {
    if (!order || paying) return;
    setPaying(true);

    if (order.paymentMethod === "Wallet") {
      try {
        const clientRequestId = advanceBalanceService.newRequestId();
        const isAdminOrManager = currentUser?.role === "admin" || currentUser?.role === "manager";

        if (isAdminOrManager) {
          const customerId = (order.customerId || (order as any).customer?._id || (order as any).customer || "") as string;
          if (!customerId) throw new Error("This order has no linked customer account to charge.");
          await advanceBalanceService.adminPayOrder({
            orderId: order._id,
            customerId,
            // Which Advance Balance was chosen is recorded on the order itself. Reading it back from
            // the payment method could never work — both advanceBalances store "Wallet" there.
            walletType: order.walletType === "business" ? "business" : "store",
            clientRequestId
          });
        } else {
          await advanceBalanceService.payOrderFromAdvanceBalance({ orderId: order._id, clientRequestId });
        }

        addToast("Payment received from your Advance Balance. Thank you!", "success");
        setOrder(await orderService.getOrderById(order._id));
      } catch (err: unknown) {
        addToast(
          err instanceof Error ? err.message : "Could not complete the Advance Balance payment.",
          "error"
        );
      } finally {
        setPaying(false);
      }
      return;
    }

    try {
      // Amount is read from the stored order server-side; nothing here can influence it.
      const init = await apiClient.post<{ orderId?: string; amount?: number; currency?: string; error?: string }>(
        "/razorpay/order", { orderId: order._id }
      );
      if (!init.orderId) throw new Error(init.error || "Failed to initialize payment gateway");

      await openRazorpayCheckout({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: String(init.amount),
        currency: init.currency || "INR",
        name: "FlexSell Wholesale",
        description: `Payment for order ${order._id}`,
        order_id: init.orderId,
        handler: async (response: any) => {
          try {
            const res = await apiClient.post<{ success?: boolean; error?: string }>("/razorpay/verify", {
              orderId: order._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (!res.success) throw new Error(res.error || "Payment verification failed");
            addToast("Payment received. Thank you!", "success");
            setOrder(await orderService.getOrderById(order._id));
          } catch (err: unknown) {
            // The webhook is the backstop if this failed after capture.
            addToast(
              `${err instanceof Error ? err.message : "Could not confirm payment"}. If you were debited it will be confirmed shortly.`,
              "warning"
            );
          } finally {
            setPaying(false);
          }
        },
        modal: { ondismiss: () => setPaying(false) },
        prefill: {
          name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
          email: order.shippingAddress.email,
          contact: order.shippingAddress.phone,
        },
        theme: { color: "#10b981" },
      } as Record<string, unknown>, {
        onPaymentFailed: (r) => {
          const failure = r as { error?: { description?: string } };
          setPaying(false);
          addToast(`Payment failed: ${failure.error?.description || "Payment was not completed."}`, "error");
        },
      });
    } catch (err: unknown) {
      // Nothing to unwind here — unlike checkout, this order already exists and stays as it
      // was. The buyer can simply press the button again.
      addToast(err instanceof Error ? err.message : "Could not start payment gateway", "error");
      setPaying(false);
    }
  };

  const handlePrint = () => {
    const customerName = order?.shippingAddress.company || (order?.shippingAddress.firstName ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : "");
    triggerPrintWithTitle("Invoice", order?._id || (orderId as string), customerName, undefined, "printing-inline-document");
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
          <h1 className="text-4xl font-extrabold tracking-tight">
            {needsPayment ? "Order Placed" : "Order Confirmed!"}
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            {needsPayment
              ? "Your order is saved but payment is still pending. Complete it below to send it for fulfillment."
              : "Thank you for sourcing with FlexSell. Your B2B order has been generated and queued for wholesale fulfillment."}
          </p>
          {needsPayment && (
            <div className="pt-1">
              <Button onClick={handleCompletePayment} disabled={paying} size="lg" className="flex items-center gap-2 font-semibold mx-auto">
                <CreditCard className="h-4 w-4" />
                {paying ? "Opening payment..." : `Complete Payment · ${formatPrice(order.amount)}`}
              </Button>
            </div>
          )}
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
                  <span className="font-semibold text-foreground">{order.date || (order.createdAt ? formatDateIST(new Date(order.createdAt)) : "")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-xs uppercase font-bold tracking-wider">Payment Status</span>
                  <span className={order.paymentStatus === "Paid" ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                    {order.paymentStatus === "Paid" ? "Paid" : order.paymentMethod === "COD" ? "Cash on Delivery" : (order.paymentStatus || "Pending")}
                  </span>
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
          sellerInfo={buildSellerInfo(cmsData)}
          showActions={false}
        />
      </div>
    </div>
  );
}
