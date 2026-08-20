"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Info, X, Download } from "lucide-react";
import { useOrderStore, Order, ShipmentDetails } from "@/stores/orderStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { collectOrderPaymentOnline } from "@/lib/razorpayCollect";
import { describePaymentFailure } from "@/lib/paymentErrors";
import { OrdersListTable } from "./OrdersListTable";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { FulfillmentForm } from "./FulfillmentForm";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";
import { exportOrdersToExcel } from "@/lib/excel/orderExporter";
import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import { InvoiceCreateModal } from "@/components/admin/invoice/InvoiceCreateModal";

import { useSearchParams } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";

export function AdminOrdersManager({ initialTab = "ALL" }: { initialTab?: "ALL" | "B2B" | "Dropshipping" | "B2C" }) {
  const searchParams = useSearchParams();
  const { orders, initializeOrders, updateOrderStatus, shipOrder } = useOrderStore();
  const { addToast } = useToastStore();
  const confirm = useConfirmStore((state) => state.confirm);
  const { hasPermission } = usePermissions();

  const invoiceForm = useInvoiceForm({
    onSuccess: () => {
      // Re-fetch orders after successful creation
      initializeOrders({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        orderType: activeOrderTab === "ALL" ? undefined : activeOrderTab,
        origin: originFilter || undefined,
      });
    }
  });

  const [searchTerm, setSearchTerm] = React.useState(searchParams.get("search") || "");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || "");

  const canB2B = hasPermission("orders_b2b");
  const canB2C = hasPermission("orders_b2c");
  const canDropshipping = hasPermission("orders_dropshipping") || hasPermission("orders_dropship");
  const canAny = canB2B || canB2C || canDropshipping;

  const allowedTabs = [
    ...(canAny ? [{ key: "ALL", label: "All Orders", icon: "📦" }] : []),
    ...(canB2B ? [{ key: "B2B", label: "Wholesale (B2B)", icon: "🏢" }] : []),
    ...(canDropshipping ? [{ key: "Dropshipping", label: "Dropshipping", icon: "🚚" }] : []),
    ...(canB2C ? [{ key: "B2C", label: "Retail (B2C)", icon: "🛒" }] : []),
  ];

  const [activeOrderTab, setActiveOrderTab] = React.useState<"ALL" | "B2B" | "Dropshipping" | "B2C">(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && allowedTabs.some(t => t.key === tabFromUrl)) return tabFromUrl as any;
    if (allowedTabs.some(t => t.key === initialTab)) return initialTab as any;
    if (allowedTabs.length > 0) return allowedTabs[0].key as any;
    return "ALL";
  });
  const [originFilter, setOriginFilter] = React.useState<"" | "self" | "website">((searchParams.get("origin") as any) || "");

  // Sync active filters to URL search parameters
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (searchTerm.trim()) params.set("search", searchTerm.trim()); else params.delete("search");
    if (startDate) params.set("startDate", startDate); else params.delete("startDate");
    if (endDate) params.set("endDate", endDate); else params.delete("endDate");
    if (originFilter) params.set("origin", originFilter); else params.delete("origin");
    if (activeOrderTab && activeOrderTab !== "ALL") params.set("tab", activeOrderTab); else params.delete("tab");

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [searchTerm, startDate, endDate, originFilter, activeOrderTab]);

  React.useEffect(() => {
    initializeOrders({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      orderType: activeOrderTab === "ALL" ? undefined : activeOrderTab,
      origin: originFilter || undefined,
    });
  }, [initializeOrders, startDate, endDate, activeOrderTab, originFilter]);

  React.useEffect(() => {
    setSelectedOrder(null);
  }, [activeOrderTab, originFilter]);

  // Create Order from Quote Modal States

  // Shipment fulfillment states
  const [isFulfilling, setIsFulfilling] = React.useState(false);

  // Dispatch payment flow states
  const [isDispatchPayModalOpen, setIsDispatchPayModalOpen] = React.useState(false);
  /**
   * Offline methods, plus the gateway — which is *run*, not recorded.
   *
   * A wallet is absent: debiting a balance needs the wallet routes, which read it and write a
   * ledger entry, and naming one here would mark the order paid against untouched money.
   */
  const [dispatchPayMethod, setDispatchPayMethod] = React.useState<"Bank Transfer" | "UPI" | "COD" | "Razorpay">("Razorpay");
  const [dispatchPayAmount, setDispatchPayAmount] = React.useState("");
  const [dispatchTxnId, setDispatchTxnId] = React.useState("");


  const activeSelectedOrder = React.useMemo(() => {
    if (!selectedOrder) return null;
    return orders.find((o) => o._id === selectedOrder._id) || null;
  }, [orders, selectedOrder]);

  React.useEffect(() => {
    setIsFulfilling(false);
  }, [selectedOrder]);

  const handleUpdateStatus = async (id: string, status: Order["status"]) => {
    try {
      await updateOrderStatus(id, status);
      addToast(`Order status updated to ${status} successfully!`, "success");
    } catch (err: any) {
      addToast(err.message || "Failed to update order status.", "error");
    }
  };

  const handleShipOrder = async (details: ShipmentDetails) => {
    if (!activeSelectedOrder) return;
    try {
      await shipOrder(activeSelectedOrder._id, details);
      addToast("Order shipment dispatched successfully!", "success");
      setIsFulfilling(false);
    } catch (err: any) {
      addToast(err.message || "Failed to dispatch shipment.", "error");
    }
  };

  const handleDispatchClick = async () => {
    if (!activeSelectedOrder) return;

    // 1. Verify payment
    if (activeSelectedOrder.paymentStatus === "Paid") {
      setIsFulfilling(true);
      return;
    }

    // 2. Payment is pending: open the custom payment modal
    setDispatchPayAmount(String(activeSelectedOrder.amount));
    setDispatchTxnId("");
    // The gateway first: it is the one method that both takes the money and proves it.
    setDispatchPayMethod("Razorpay");
    setIsDispatchPayModalOpen(true);
  };

  const triggerCodFlow = () => {
    if (!activeSelectedOrder) return;
    
    confirm({
      title: "COD Confirmation (1/3)",
      message: "Are you sure you want to dispatch this order as Cash on Delivery (COD)?",
      type: "warning",
      confirmText: "Yes, Proceed",
      onConfirm: () => {
        confirm({
          title: "COD Confirmation (2/3)",
          message: "Have you verified the buyer's shipping address and contact number for COD delivery?",
          type: "warning",
          confirmText: "Address Verified",
          onConfirm: () => {
            confirm({
              title: "COD Confirmation (3/3)",
              message: "FINAL CONFIRMATION: Once dispatched under COD, the order status will change to Shipped. Proceed?",
              type: "warning",
              confirmText: "Confirm Dispatch",
              onConfirm: async () => {
                try {
                  await updateOrderStatus(activeSelectedOrder._id, "Processing", {
                    paymentStatus: "Pending",
                    paymentMethod: "COD"
                  });
                  addToast("COD terms confirmed successfully.", "success");
                  setIsFulfilling(true);
                } catch (err: any) {
                  addToast(err.message || "Failed to update payment details.", "error");
                }
              }
            });
          }
        });
      }
    });
  };

  const handleRecordDispatchPayment = async () => {
    if (!activeSelectedOrder) return;

    /**
     * The gateway is run, not recorded.
     *
     * It charges the order's own stored total — which is also why the amount box is hidden
     * for it: there is nothing here to type that could change what gets charged.
     * `/api/razorpay/verify` settles it and issues the Tax Invoice on a verified signature.
     */
    if (dispatchPayMethod === "Razorpay") {
      try {
        const outcome = await collectOrderPaymentOnline({
          orderId: activeSelectedOrder._id,
          customerName: activeSelectedOrder.customerName,
          customerEmail: activeSelectedOrder.shippingAddress?.email,
          customerPhone: activeSelectedOrder.shippingAddress?.phone,
          description: `Payment for order ${activeSelectedOrder._id}`,
        });
        if (outcome.status === "paid") {
          addToast("Payment received. The Tax Invoice has been issued.", "success");
          setIsDispatchPayModalOpen(false);
          setIsFulfilling(true);
          initializeOrders({ startDate: startDate || undefined, endDate: endDate || undefined });
        } else {
          addToast("Payment cancelled — the order is unchanged and still payable.", "info");
        }
      } catch (err: any) {
        addToast(describePaymentFailure(err), "error");
      }
      return;
    }

    if (!dispatchPayAmount.trim()) {
      addToast("Please enter the amount received.", "error");
      return;
    }
    const amount = parseFloat(dispatchPayAmount);
    if (isNaN(amount) || amount <= 0) {
      addToast("Invalid payment amount entered.", "error");
      return;
    }
    if (dispatchPayMethod !== "COD" && !dispatchTxnId.trim()) {
      addToast("Please enter a transaction reference ID.", "error");
      return;
    }

    try {
      await updateOrderStatus(activeSelectedOrder._id, "Processing", {
        paymentStatus: "Paid",
        paymentMethod: dispatchPayMethod === "COD" ? "Cash" : dispatchPayMethod,
        // No invented reference for cash. `"CASH"` looked like a receipt number in the ledger
        // and reconciled against nothing — the cash book is the record.
        transactionId: dispatchTxnId.trim() || undefined,
      });
      addToast(`Payment of ₹${amount} received and recorded successfully!`, "success");
      setIsDispatchPayModalOpen(false);
      setIsFulfilling(true);
    } catch (err: any) {
      addToast(err.message || "Failed to update payment status.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-foreground">
            {activeOrderTab === "ALL" ? "All Orders Manager" : `${activeOrderTab} Orders Manager`}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage dispatch statuses, track logistical fulfillment, and record order payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(hasPermission("orders_b2b", "create") || hasPermission("orders_b2c", "create") || hasPermission("orders_dropshipping", "create") || hasPermission("orders_dropship", "create")) && (
            <>
              <Button
                onClick={() => {
                  invoiceForm.setFormDocType("receipt");
                  invoiceForm.setIsOrderCreationMode(true);
                  invoiceForm.setFormCustomerType(activeOrderTab === "ALL" ? "B2B" : activeOrderTab);
                  invoiceForm.setIsCreateModalOpen(true);
                }}
                className="flex items-center gap-1.5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Create Order
              </Button>
            </>
          )}
          <Button
            onClick={() => exportOrdersToExcel(orders)}
            variant="outline"
            className="flex items-center gap-1.5 font-bold text-xs cursor-pointer border-green-600/30 text-green-700 hover:bg-green-50"
          >
            <Download className="h-4 w-4" /> Export Orders
          </Button>
        </div>
      </div>

      {/* Short Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Volume</p>
              <h3 className="text-lg font-black mt-1 text-foreground">{orders.length}</h3>
            </div>
            <div className="p-2 rounded-lg bg-primary/5 text-primary text-base">
              📦
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Amount</p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {formatPrice(orders.reduce((sum, o) => sum + o.amount, 0))}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 text-green-600 dark:text-green-400 text-base">
              💰
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pending Payment</p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {orders.filter(o => o.paymentStatus !== "Paid").length}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 text-base">
              ⏳
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">To Dispatch</p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {orders.filter(o => o.status === "Processing").length}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/5 text-blue-600 dark:text-blue-400 text-base">
              🚚
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Tab Selector */}
      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto scrollbar-none">
        {allowedTabs.map((tab) => {
          const isSelected = activeOrderTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveOrderTab(tab.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-card border border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Orders Table (Full Width) */}
      <div className="w-full">
        <OrdersListTable
          orders={orders}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          selectedOrderId={selectedOrder?._id || null}
          onSelectOrder={(order) => setSelectedOrder(order)}
          originFilter={originFilter}
          setOriginFilter={setOriginFilter}
        />
      </div>

      <InvoiceCreateModal
        {...invoiceForm}
        isOpen={invoiceForm.isCreateModalOpen}
        onClose={() => invoiceForm.setIsCreateModalOpen(false)}
        onSaveInvoice={invoiceForm.handleSaveInvoice}
      />

      {/* ─── DISPATCH PAYMENT / MODAL ─── */}
      {isDispatchPayModalOpen && activeSelectedOrder && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">Record Order Payment</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer hover:bg-secondary"
                onClick={() => setIsDispatchPayModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4">
              Payment is pending for order <span className="font-mono font-bold text-foreground">{activeSelectedOrder._id}</span>.
              Provide payment details to record as Paid, or choose COD option.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Payment Option</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDispatchPayModalOpen(false);
                      triggerCodFlow();
                    }}
                    className="flex flex-col items-center justify-center p-3.5 border rounded-xl hover:bg-secondary/15 transition-all text-center text-xs font-semibold cursor-pointer border-dashed"
                  >
                    <span className="text-sm">🚚 COD</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">Pay on delivery</span>
                  </button>
                  <div
                    className="flex flex-col items-center justify-center p-3.5 border-2 border-primary bg-primary/5 rounded-xl text-center text-xs font-semibold"
                  >
                    <span className="text-sm text-primary font-bold">💳 Pay Now</span>
                    <span className="text-[10px] text-primary/80 mt-0.5">Clear payment today</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                {/*
                  Hidden for the gateway: it charges the order's stored total, so an editable
                  amount here would suggest a control that does not exist.
                */}
                {dispatchPayMethod !== "Razorpay" && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Amount Received (₹) *</label>
                    <Input
                      type="number"
                      value={dispatchPayAmount}
                      onChange={(e) => setDispatchPayAmount(e.target.value)}
                      placeholder="e.g. 5000"
                      required
                      className="text-xs"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
                  <select
                    value={dispatchPayMethod}
                    onChange={(e) => setDispatchPayMethod(e.target.value as any)}
                    className="bg-background text-foreground text-xs w-full px-2.5 py-2 border rounded-md cursor-pointer"
                  >
                    {/*
                      Razorpay runs the real gateway against this order. The rest are payments
                      already collected offline, which staff attest to with a reference.

                      Wallets are absent: debiting a balance needs the wallet routes, which
                      read it and write a ledger entry — naming one here would mark the order
                      paid against untouched money. The server refuses both that and a
                      hand-recorded Razorpay.
                    */}
                    <option value="Razorpay">Online (Razorpay) — card / netbanking / UPI</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI</option>
                    <option value="COD">Cash (COD)</option>
                  </select>
                </div>

                {dispatchPayMethod === "Razorpay" ? (
                  <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Razorpay opens for {formatPrice(Number(activeSelectedOrder?.amount) || 0)}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Charged at the order&apos;s own stored total. The Tax Invoice is issued
                      once the signature verifies — nothing to type.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      {dispatchPayMethod === "COD" ? "Cash receipt no. (optional)" : "Transaction reference / UTR *"}
                    </label>
                    <Input
                      value={dispatchTxnId}
                      onChange={(e) => setDispatchTxnId(e.target.value)}
                      placeholder={dispatchPayMethod === "COD" ? "e.g. receipt book no. 0142" : "e.g. UTR100293847"}
                      required={dispatchPayMethod !== "COD"}
                      className="text-xs font-mono"
                    />
                    {dispatchPayMethod === "COD" && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Cash reconciles against the cash book — leave blank rather than
                        inventing a reference.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-6">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setIsDispatchPayModalOpen(false)}
                className="cursor-pointer text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRecordDispatchPayment}
                className="font-bold text-xs cursor-pointer bg-primary text-primary-foreground"
              >
                Confirm Payment & Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
