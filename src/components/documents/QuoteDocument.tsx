"use client";

import * as React from "react";
import { InvoiceDocument } from "./InvoiceDocument";
import { CartItem, TaxBreakdown, SellerInfo } from "@/types";

export interface QuoteDocumentProps {
  quoteId: string;
  items: CartItem[];
  taxDetails: TaxBreakdown;
  buyerState: string;
  sellerInfo: SellerInfo;
  showActions?: boolean;
  shippingConfig?: any;
  salesperson?: string;
}

export function QuoteDocument({
  quoteId,
  items,
  taxDetails,
  buyerState,
  sellerInfo,
  showActions = true,
  shippingConfig,
  salesperson,
}: QuoteDocumentProps) {
  const shippingCharge = shippingConfig?.b2bFixedCharge ?? 0;
  const grandTotal = taxDetails.baseSubtotal + taxDetails.cgst + taxDetails.sgst + taxDetails.igst + shippingCharge;

  return (
    <InvoiceDocument
      type="quote"
      documentNumber={quoteId}
      order={{
        _id: quoteId,
        date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }),
        amount: grandTotal,
        customerName: "Wholesale Buyer",
        shippingAddress: {
          firstName: "Wholesale",
          lastName: "Buyer",
          email: "",
          company: "",
          address: "Domestic Delivery Dock",
          city: "State Delivery",
          state: buyerState || "Madhya Pradesh",
          pinCode: "452001",
          phone: "",
        },
        items: items,
      }}
      sellerInfo={sellerInfo}
      taxBreakdown={taxDetails}
      showActions={showActions}
      salesperson={salesperson}
    />
  );
}
