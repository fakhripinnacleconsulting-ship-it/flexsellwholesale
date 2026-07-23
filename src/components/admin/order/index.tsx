"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Plus, Info, X } from "lucide-react";
import { useOrderStore, Order, ShipmentDetails } from "@/stores/orderStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { orderService } from "@/services/orderService";
import { OrdersListTable } from "./OrdersListTable";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { FulfillmentForm } from "./FulfillmentForm";
import { CreateOrderModal } from "./CreateOrderModal";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";

export function AdminOrdersManager() {
  const { orders, initializeOrders, updateOrderStatus, shipOrder } = useOrderStore();
  const { addToast } = useToastStore();
  const confirm = useConfirmStore((state) => state.confirm);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null);

  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const [activeOrderTab, setActiveOrderTab] = React.useState<"B2B" | "B2C">("B2B");
  const [originFilter, setOriginFilter] = React.useState<"" | "self" | "website">("");

  React.useEffect(() => {
    initializeOrders({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      orderType: activeOrderTab,
      origin: originFilter || undefined,
    });
  }, [initializeOrders, startDate, endDate, activeOrderTab, originFilter]);

  React.useEffect(() => {
    setSelectedOrder(null);
  }, [activeOrderTab, originFilter]);

  // Create Order from Quote Modal States
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = React.useState(false);
  const [initialQuoteId, setInitialQuoteId] = React.useState<string | null>(null);

  // Shipment fulfillment states
  const [isFulfilling, setIsFulfilling] = React.useState(false);

  // Dispatch payment flow states
  const [isDispatchPayModalOpen, setIsDispatchPayModalOpen] = React.useState(false);
  const [dispatchPayMethod, setDispatchPayMethod] = React.useState<"Bank Transfer" | "UPI" | "Razorpay" | "COD">("Bank Transfer");
  const [dispatchPayAmount, setDispatchPayAmount] = React.useState("");
  const [dispatchTxnId, setDispatchTxnId] = React.useState("");


  // URL listener for auto-open quote conversion
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const qId = params.get("confirmQuoteId");
      if (qId) {
        setInitialQuoteId(qId);
        setIsCreateOrderModalOpen(true);
      }
    }
  }, [addToast]);

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
      addToast("Order cargo dispatched successfully!", "success");
      setIsFulfilling(false);
    } catch (err: any) {
      addToast(err.message || "Failed to dispatch cargo.", "error");
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
    setDispatchPayMethod("Bank Transfer");
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
    if (!dispatchPayAmount.trim()) {
      alert("Please enter the amount received.");
      return;
    }
    const amount = parseFloat(dispatchPayAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Invalid payment amount entered.");
      return;
    }
    if (dispatchPayMethod !== "COD" && !dispatchTxnId.trim()) {
      alert("Please enter a transaction reference ID.");
      return;
    }

    try {
      await updateOrderStatus(activeSelectedOrder._id, "Processing", {
        paymentStatus: "Paid",
        paymentMethod: dispatchPayMethod,
        transactionId: dispatchPayMethod === "COD" ? (dispatchTxnId.trim() || "CASH") : dispatchTxnId.trim(),
      });
      addToast(`Payment of ₹${amount} received and recorded successfully!`, "success");
      setIsDispatchPayModalOpen(false);
      setIsFulfilling(true);
    } catch (err: any) {
      addToast(err.message || "Failed to update payment status.", "error");
    }
  };

  const handleConfirmOrder = async (payload: {
    quoteId: string;
    salesperson?: string;
    paymentOption: "now" | "later";
    paymentMethod?: "Bank Transfer" | "Razorpay" | "UPI" | "COD";
    transactionId?: string;
    shippingAddress?: any;
  }) => {
    try {
      const paymentDetails = {
        paymentMethod: payload.paymentOption === "later" ? "COD" : payload.paymentMethod,
        paymentStatus: payload.paymentOption === "later" ? "Pending" : "Paid",
        transactionId: payload.paymentOption === "later" ? undefined : payload.transactionId,
      };

      const qId = payload.quoteId;
      const response = await orderService.createOrder(
        [], 
        0,
        payload.shippingAddress || {} as any, 
        paymentDetails as any,
        undefined,
        undefined,
        qId,
        payload.salesperson
      );

      addToast("Quote converted and Order created successfully!", "success");
      setIsCreateOrderModalOpen(false);
      setInitialQuoteId(null);

      // Refresh order list
      initializeOrders({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
    } catch (err: any) {
      addToast(err.message || "Failed to convert quote to order.", "error");
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-foreground">B2B/B2C Orders Manager</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage dispatch statuses, track logistical fulfillment, and convert approved price quotes.
          </p>
        </div>
        <Button
          onClick={() => {
            setInitialQuoteId(null);
            setIsCreateOrderModalOpen(true);
          }}
          className="flex items-center gap-1.5 font-bold text-xs bg-primary text-primary-foreground cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Convert Quote
        </Button>
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

      <CreateOrderModal
        isOpen={isCreateOrderModalOpen}
        onClose={() => {
          setIsCreateOrderModalOpen(false);
          setInitialQuoteId(null);
        }}
        onConfirmOrder={handleConfirmOrder}
        initialQuoteId={initialQuoteId}
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
                
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
                  <select
                    value={dispatchPayMethod}
                    onChange={(e) => setDispatchPayMethod(e.target.value as any)}
                    className="bg-background text-foreground text-xs w-full px-2.5 py-2 border rounded-md cursor-pointer"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="Razorpay">Razorpay</option>
                    <option value="COD">Cash (COD)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    {dispatchPayMethod === "COD" ? "Transaction reference ID (Optional)" : "Transaction reference ID *"}
                  </label>
                  <Input
                    value={dispatchTxnId}
                    onChange={(e) => setDispatchTxnId(e.target.value)}
                    placeholder={dispatchPayMethod === "COD" ? "e.g. CASH (or leave blank)" : "e.g. TXN100293847"}
                    required={dispatchPayMethod !== "COD"}
                    className="text-xs font-mono"
                  />
                </div>
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
