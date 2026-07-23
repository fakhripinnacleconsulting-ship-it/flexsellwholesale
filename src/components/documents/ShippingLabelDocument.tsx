"use client";

import * as React from "react";
import { Order, SellerInfo } from "@/types";
import { Printer, X, Package, ShieldCheck, MapPin, Phone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface ShippingLabelDocumentProps {
  order: Order;
  sellerInfo?: SellerInfo;
  onClose?: () => void;
}

export function ShippingLabelDocument({ order, sellerInfo, onClose }: ShippingLabelDocumentProps) {
  const seller = sellerInfo || {
    storeName: "FlexSell Wholesale",
    address: "Plot No. 12, GIDC Industrial Estate, Sachin, Surat, Gujarat - 394230",
    email: "support@flexsell.in",
    phone: "+91 261 2409000",
    gstin: "24AAACF1001M1Z5",
  };

  const shipment = order.shipmentDetails || {
    type: "self",
    trackingId: `FLEX-${order._id}`,
    carrierName: "FlexSell In-House Cargo",
  };

  const isCod = order.paymentMethod === "COD";

  // Calculate total package weight
  const totalWeightGrams = order.items.reduce((acc, item) => {
    const wg = (item as any).weightGrams || 250;
    return acc + wg * item.quantity;
  }, 0);
  const totalWeightKg = (totalWeightGrams / 1000).toFixed(2);

  const handlePrint = () => {
    window.print();
  };

  const trackingCode = shipment.shiprocket?.awbCode || shipment.trackingId || order._id;
  const carrierTitle = shipment.type === "shiprocket"
    ? (shipment.shiprocket?.courierName || "Shiprocket Express")
    : shipment.type === "third-party"
    ? (shipment.carrierName || "Third-Party Logistics")
    : "FlexSell In-House Cargo Dispatch";

  return (
    <div className="bg-background text-foreground p-4 max-w-2xl mx-auto space-y-4">
      {/* Actions header (Hidden during print) */}
      <div className="flex justify-between items-center no-print bg-secondary/30 p-3 rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <span className="font-bold text-sm">Cargo Dispatch Label Preview</span>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono font-bold">
            {shipment.type.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handlePrint} className="font-bold flex items-center gap-1.5 text-xs bg-primary text-primary-foreground">
            <Printer className="h-4 w-4" /> Print Shipping Label
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* PRINTABLE LABEL CONTAINER (4x6 ratio / A6 / A5 printable card) */}
      <div className="shipping-label-printable border-2 border-black bg-white text-black p-5 rounded-none font-sans space-y-4 shadow-lg print:shadow-none print:border-2 print:border-black print:m-0 print:p-4 print:w-full">
        
        {/* Header Bar: Branding & Barcode */}
        <div className="border-b-2 border-black pb-3 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight uppercase border-b-2 border-black inline-block pb-0.5">
              {seller.storeName}
            </h1>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-700 mt-1">
              B2B WHOLESALE CARGO DISPATCH
            </p>
          </div>

          <div className="text-right">
            <div className="inline-block px-3 py-1 bg-black text-white font-extrabold text-xs uppercase tracking-wider">
              {isCod ? "C.O.D. ORDER" : "PREPAID DISPATCH"}
            </div>
            <p className="text-[10px] font-mono font-bold mt-1">Order #: {order._id}</p>
          </div>
        </div>

        {/* Carrier & Tracking Barcode Section */}
        <div className="border-b-2 border-black pb-3 text-center bg-gray-50 p-2.5">
          <div className="flex justify-between items-center mb-1 text-[11px] font-bold uppercase">
            <span>Carrier: <strong>{carrierTitle}</strong></span>
            <span>Date: {order.date}</span>
          </div>

          {/* Simulated SVG Barcode */}
          <div className="flex flex-col items-center justify-center my-1.5">
            <div className="h-10 flex items-center gap-[2px] overflow-hidden">
              {[3,1,2,4,1,3,1,2,3,1,4,2,1,3,2,1,4,1,2,3,1,2,4,1,3,1,2,3,1,4,2,1,3].map((w, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${w * 2}px` }} />
              ))}
            </div>
            <span className="font-mono font-extrabold text-sm tracking-widest mt-1 uppercase">
              *{trackingCode}*
            </span>
          </div>
        </div>

        {/* Address Grid: SHIP TO (Destination) vs SHIP FROM (Origin) */}
        <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 text-xs">
          
          {/* SHIP TO (Recipient) */}
          <div className="space-y-1.5 pr-2 border-r-2 border-black">
            <div className="bg-black text-white font-extrabold text-[10px] uppercase px-1.5 py-0.5 inline-block">
              SHIP TO (DELIVERY DOCK)
            </div>
            <p className="font-extrabold text-sm uppercase leading-tight mt-1">
              {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            </p>
            {order.shippingAddress.company && (
              <p className="font-bold text-xs text-gray-800 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" /> {order.shippingAddress.company}
              </p>
            )}
            <p className="font-semibold text-xs leading-snug mt-1">
              {order.shippingAddress.address}
              {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}
            </p>
            <p className="font-extrabold text-xs uppercase mt-1">
              {order.shippingAddress.city}, {order.shippingAddress.state} - <span className="text-sm border-b border-black">{order.shippingAddress.pinCode}</span>
            </p>
            <p className="font-mono font-bold text-xs pt-1 flex items-center gap-1">
              <Phone className="h-3 w-3 shrink-0" /> Ph: {order.shippingAddress.phone}
            </p>
            {order.shippingAddress.gstin && (
              <p className="font-mono font-bold text-[10px] text-gray-700">
                GSTIN: {order.shippingAddress.gstin}
              </p>
            )}
          </div>

          {/* SHIP FROM (Origin Warehouse) */}
          <div className="space-y-1.5 pl-2">
            <div className="bg-gray-200 text-black font-extrabold text-[10px] uppercase px-1.5 py-0.5 inline-block border border-black">
              RETURN / SHIP FROM (ORIGIN)
            </div>
            <p className="font-extrabold text-xs uppercase mt-1">{seller.storeName}</p>
            <p className="text-[11px] leading-tight text-gray-800">{seller.address}</p>
            <p className="font-mono font-bold text-[11px]">Ph: {seller.phone}</p>
            <p className="font-mono text-[10px] text-gray-700">GSTIN: {seller.gstin}</p>
          </div>
        </div>

        {/* Cargo Package Specs & Items Manifest Summary */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center bg-gray-100 p-2 border border-black font-bold text-[11px]">
            <span>Total Units: {order.itemsCount} Items</span>
            <span>Est Weight: {totalWeightKg} kg</span>
            <span>Decl Value: ₹{order.amount.toLocaleString()}</span>
          </div>

          <div className="border border-black">
            <table className="w-full text-left text-[10px]">
              <thead className="bg-gray-200 border-b border-black font-bold uppercase">
                <tr>
                  <th className="p-1.5">Item Description</th>
                  <th className="p-1.5 text-center">Variant</th>
                  <th className="p-1.5 text-center">Barcode</th>
                  <th className="p-1.5 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300 font-medium">
                {order.items.slice(0, 4).map((item, i) => {
                  const prodBarcodeImg = item.product?.barcodeImage || (item as any).subVariant?.barcodeImage;
                  const prodBarcodeVal = item.product?.barcode || (item as any).subVariant?.barcode || (item as any).subVariant?.sku || item.product?.slug || "-";

                  return (
                    <tr key={i}>
                      <td className="p-1.5 font-bold truncate max-w-[150px]">
                        {item.product?.title || "Product Item"}
                      </td>
                      <td className="p-1.5 text-center text-gray-700">
                        {item.selectedVariants?.Color || ""} {item.selectedVariants?.Size || ""}
                      </td>
                      <td className="p-1.5 text-center">
                        {prodBarcodeImg ? (
                          <img src={prodBarcodeImg} alt="Barcode" className="h-6 mx-auto object-contain" />
                        ) : (
                          <span className="font-mono text-[9px] text-gray-700">{prodBarcodeVal}</span>
                        )}
                      </td>
                      <td className="p-1.5 text-right font-extrabold">{item.quantity}</td>
                    </tr>
                  );
                })}
                {order.items.length > 4 && (
                  <tr>
                    <td colSpan={4} className="p-1 text-center italic text-gray-600 bg-gray-50">
                      + {order.items.length - 4} additional SKU items listed in commercial invoice
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Warning & Security Badge */}
        <div className="border-t-2 border-black pt-2 flex justify-between items-center text-[9px] text-gray-700 uppercase font-bold">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-black shrink-0" /> Verified FlexSell B2B Cargo Dispatch
          </span>
          <span>Handle With Care • Keep Dry</span>
        </div>

      </div>
    </div>
  );
}
