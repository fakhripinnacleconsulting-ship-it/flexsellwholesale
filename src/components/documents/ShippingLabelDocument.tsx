"use client";

import * as React from "react";
import { InvoiceDocument } from "./InvoiceDocument";
import { Order, SellerInfo } from "@/types";

export interface ShippingLabelDocumentProps {
  order: Order;
  sellerInfo?: SellerInfo;
  onClose?: () => void;
}

export function ShippingLabelDocument({ order, sellerInfo, onClose }: ShippingLabelDocumentProps) {
  const seller = sellerInfo || {
    storeName: "FlexSell Wholesale",
    legalName: "FlexSell Wholesale Sourcing Pvt Ltd",
    address: "Plot No. 12, GIDC Industrial Estate, Sachin, Bhopal, Gujarat - 394230",
    email: "support@flexsell.in",
    phone: "+91 261 2409000",
    gstin: "24AAACF1001M1Z5",
  };

  const shipment = order.shipmentDetails || {
    type: "self",
    trackingId: `FLEX-${order._id}`,
    carrierName: "FlexSell In-House Transport",
  };

  return (
    <InvoiceDocument
      type="shipping_label"
      documentNumber={shipment.shiprocket?.awbCode || shipment.trackingId || order._id}
      order={order}
      sellerInfo={seller}
      shipmentDetails={{
        carrierName: shipment.carrierName,
        awbNumber: shipment.shiprocket?.awbCode || shipment.trackingId,
        dispatchType: order.paymentMethod === "COD" ? "COD" : "PREPAID",
      }}
      showActions={true}
    />
  );
}
