"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Truck, CheckCircle, Clock, X, Printer } from "lucide-react";
import { Order } from "@/stores/orderStore";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

interface OrderDetailPanelProps {
  order: Order;
  onUpdateStatus: (id: string, status: Order["status"]) => Promise<void>;
  onToggleFulfill: () => void;
  onClose: () => void;
}

export function OrderDetailPanel({
  order,
  onUpdateStatus,
  onToggleFulfill,
  onClose,
}: OrderDetailPanelProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleStatusChange = async (status: Order["status"]) => {
    setIsSubmitting(true);
    try {
      await onUpdateStatus(order._id, status);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="sticky top-24 border border-border">
      <CardHeader className="flex flex-row justify-between items-center border-b p-4">
        <div>
          <CardTitle className="text-sm font-bold uppercase">Order Information</CardTitle>
          <CardDescription className="text-[10px] font-mono">{order._id}</CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          {order.invoiceId && (
            <Link href={`/admin/invoices?search=${order.invoiceId}`} target="_blank">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 cursor-pointer"
                title="View Tax Invoice"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 cursor-pointer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Fulfillment Control Block */}
        <div className="flex justify-between items-center bg-secondary/15 p-3.5 rounded-lg border border-border/80">
          <div>
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">Fulfillment Actions</span>
            <span className="text-xs text-foreground font-semibold mt-0.5 block">Update Order Lifecycle</span>
          </div>
          <div className="flex items-center gap-2">
            {order.status === "Processing" && (
              <>
                <Button
                  size="sm"
                  onClick={onToggleFulfill}
                  className="bg-primary text-primary-foreground flex items-center gap-1 h-8 text-xs font-bold cursor-pointer"
                >
                  <Truck className="h-3.5 w-3.5" /> Dispatch Order
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange("Cancelled")}
                  className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive h-8 text-xs font-bold cursor-pointer"
                >
                  Cancel Order
                </Button>
              </>
            )}
            {order.status === "Shipped" && (
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange("Delivered")}
                  className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 h-8 text-xs font-bold cursor-pointer"
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Mark Delivered
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => handleStatusChange("Cancelled")}
                  className="text-destructive hover:bg-destructive/10 border-destructive/30 hover:border-destructive h-8 text-xs font-bold cursor-pointer"
                >
                  Cancel Order
                </Button>
              </div>
            )}
            {(order.status === "Delivered" || order.status === "Cancelled") && (
              <span className="text-xs font-bold text-muted-foreground uppercase italic p-1 border rounded bg-secondary/20">
                Workflow Completed ({order.status})
              </span>
            )}
          </div>
        </div>

        {/* Tracking Details display if already Shipped or Delivered */}
        {order.shipmentDetails && (
          <div className="bg-primary/5 border border-primary/15 p-4 rounded-lg space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Truck className="h-4 w-4" /> Dispatch Tracking Info:
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Courier Type:</p>
                <p className="font-bold capitalize">{order.shipmentDetails.type}</p>
              </div>
              {order.shipmentDetails.carrierName && (
                <div>
                  <p className="text-muted-foreground">Carrier Name:</p>
                  <p className="font-bold">{order.shipmentDetails.carrierName}</p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-muted-foreground">Tracking ID:</p>
                <p className="font-mono font-bold text-foreground bg-secondary/35 px-1.5 py-0.5 rounded inline-block">
                  {order.shipmentDetails.trackingId}
                </p>
              </div>
              {order.shipmentDetails.trackingUrl && (
                <div className="col-span-2">
                  <p className="text-muted-foreground">Tracking Link:</p>
                  <a
                    href={order.shipmentDetails.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-semibold hover:underline break-all"
                  >
                    {order.shipmentDetails.trackingUrl}
                  </a>
                </div>
              )}
              {order.shipmentDetails.estimatedDelivery && (
                <div>
                  <p className="text-muted-foreground">Est. Delivery:</p>
                  <p className="font-bold">{order.shipmentDetails.estimatedDelivery}</p>
                </div>
              )}
            </div>
            {order.shipmentDetails.notes && (
              <div className="pt-2 border-t text-xs">
                <p className="text-muted-foreground font-semibold">Dispatch Note:</p>
                <p className="italic text-muted-foreground mt-0.5">{order.shipmentDetails.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Payment & Invoice block */}
        <div className="bg-secondary/10 border p-4 rounded-lg space-y-2 text-xs">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground pb-1 border-b">
            Payment details:
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-muted-foreground">Method:</p>
              <p className="font-bold">{order.paymentMethod || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status:</p>
              <p
                className={`font-bold ${
                  order.paymentStatus === "Paid" ? "text-green-600" : "text-amber-500"
                }`}
              >
                {order.paymentStatus || "Pending"}
              </p>
            </div>
            {order.transactionId && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Transaction ID:</p>
                <p className="font-mono font-semibold break-all bg-secondary/30 p-1 rounded inline-block">
                  {order.transactionId}
                </p>
              </div>
            )}
            {order.invoiceId && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Linked Billing Doc:</p>
                <p className="font-mono font-bold text-primary">{order.invoiceId}</p>
              </div>
            )}
            {order.salesperson && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Salesperson Name:</p>
                <p className="font-bold text-foreground">{order.salesperson}</p>
              </div>
            )}
          </div>
        </div>

        {/* Shipping Credentials */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Shipping Credentials:
          </h4>
          <p className="font-bold">
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
          </p>
          {order.shippingAddress.company && (
            <p className="text-xs text-muted-foreground font-medium">
              {order.shippingAddress.company}
            </p>
          )}
          <p className="text-muted-foreground mt-1">{order.shippingAddress.address}</p>
          <p className="text-muted-foreground">
            {order.shippingAddress.city}, {order.shippingAddress.state} -{" "}
            {order.shippingAddress.pinCode}
          </p>
          <p className="text-muted-foreground mt-1">Email: {order.shippingAddress.email}</p>
          <p className="text-muted-foreground">Phone: {order.shippingAddress.phone}</p>
          {order.shippingAddress.gstin && (
            <p className="text-emerald-600 dark:text-emerald-400 font-mono mt-1 text-[11px] font-bold">
              GST: {order.shippingAddress.gstin}
            </p>
          )}
        </div>

        {/* Timeline History */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Shipment Timeline Log:
          </h4>
          <div className="relative pl-4 border-l border-border space-y-4 ml-1">
            {order.history &&
              order.history.map((ev, i) => (
                <div key={i} className="relative space-y-1">
                  <div
                    className={`absolute -left-[21.5px] top-1 h-3 w-3 rounded-full border-2 bg-background ${
                      ev.status === "Delivered"
                        ? "border-green-600 bg-green-600"
                        : ev.status === "Shipped"
                        ? "border-primary bg-primary"
                        : ev.status === "Cancelled"
                        ? "border-destructive bg-destructive"
                        : ev.status === "Receipt Deleted"
                        ? "border-amber-500 bg-amber-500"
                        : "border-yellow-500 bg-yellow-500"
                    }`}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">{ev.status}</span>
                    <span className="text-[10px] text-muted-foreground">{ev.timestamp}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{ev.description}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Order Cargo Items */}
        <div className="border-t pt-4">
          <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">
            Order Cargo Items:
          </h4>
          {order.items && order.items.length > 0 ? (
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start text-xs">
                  <div className="max-w-[70%]">
                    <p className="font-semibold text-foreground line-clamp-1">
                      {item.product.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Qty: {item.quantity} x {formatPrice(item.pricePerUnit)}
                    </p>
                    {item.selectedVariants && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {Object.entries(item.selectedVariants)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(" | ")}
                      </p>
                    )}
                  </div>
                  <span className="font-medium text-foreground">
                    {formatPrice(item.pricePerUnit * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Order generated with blank default parameters.
            </p>
          )}
        </div>

        <div className="border-t pt-4 flex justify-between font-bold text-base text-foreground">
          <span>Grand Total (incl. GST)</span>
          <span>{formatPrice(order.amount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
