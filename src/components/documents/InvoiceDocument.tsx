"use client";

import * as React from "react";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import { Order, CartItem, TaxBreakdown, SellerInfo, HsnSlab } from "@/types";
import { useProductStore } from "@/stores/productStore";

export interface InvoiceDocumentProps {
  type: "invoice" | "receipt" | "quote";
  documentNumber: string;
  order: Order;
  sellerInfo: SellerInfo;
  taxBreakdown?: TaxBreakdown;
  showActions?: boolean;
  customerId?: string;
}

function computeTaxBreakdown(order: Order, sellerState: string): TaxBreakdown {
  const buyerState = order.shippingAddress.state;
  const isIntrastate = buyerState.toLowerCase() === sellerState.toLowerCase();
  const hsnMap: Record<string, HsnSlab> = {};
  let baseSubtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  order.items.forEach((item) => {
    const rate = item.product?.gstRate ?? 18;
    const hsn = item.product?.hsnCode ?? "3924";
    const isIncl = item.product?.priceIncludesGst ?? true;
    const totalAmount = item.pricePerUnit * item.quantity;

    let itemBase = 0;
    let itemTax = 0;

    if (isIncl) {
      itemBase = totalAmount / (1 + rate / 100);
      itemTax = totalAmount - itemBase;
    } else {
      itemBase = totalAmount;
      itemTax = itemBase * (rate / 100);
    }

    baseSubtotal += itemBase;

    let cgst = 0, sgst = 0, igst = 0;
    if (isIntrastate) {
      cgst = itemTax / 2;
      sgst = itemTax / 2;
      totalCgst += cgst;
      totalSgst += sgst;
    } else {
      igst = itemTax;
      totalIgst += igst;
    }

    if (!hsnMap[hsn]) {
      hsnMap[hsn] = { hsnCode: hsn, gstRate: rate, baseAmount: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0 };
    }
    hsnMap[hsn].baseAmount += itemBase;
    hsnMap[hsn].totalTax += itemTax;
    hsnMap[hsn].cgst += cgst;
    hsnMap[hsn].sgst += sgst;
    hsnMap[hsn].igst += igst;
  });

  return {
    isIntrastate,
    baseSubtotal,
    cgst: totalCgst,
    sgst: totalSgst,
    igst: totalIgst,
    hsnSlabs: Object.values(hsnMap),
  };
}

export function InvoiceDocument({
  type,
  documentNumber,
  order,
  sellerInfo,
  taxBreakdown: providedTaxBreakdown,
  showActions = true,
  customerId,
}: InvoiceDocumentProps) {
  const { products } = useProductStore();
  // Extract seller state from address for tax computation
  const sellerStateMatch = sellerInfo.address.match(/(?:,\s*)([A-Za-z\s]+?)(?:\s*-\s*\d|$)/);
  const sellerState = sellerStateMatch ? sellerStateMatch[1].trim() : "Madhya Pradesh";
  const tax = providedTaxBreakdown || computeTaxBreakdown(order, sellerState);
  const grandTotal = order.amount;
  const isInvoice = type === "invoice";
  const isQuote = type === "quote";
  const documentTitle = isQuote ? "Price Quote" : isInvoice ? "Tax Invoice" : "Payment Receipt";

  const itemTotalWithGst = order.items.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0);
  const couponDiscount = order.couponDiscount || 0;
  const rawShipping = order.amount - itemTotalWithGst + couponDiscount;
  const shippingCharge = rawShipping > 0.01 ? parseFloat(rawShipping.toFixed(2)) : 0;

  const handlePrint = () => window.print();

  return (
    <div className="invoice-document bg-white text-gray-900 max-w-4xl mx-auto">
      {/* Print/Download Controls */}
      {showActions && (
        <div className="no-print flex justify-end gap-3 mb-6 pb-4 border-b border-gray-200">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg shadow cursor-pointer transition-colors"
          >
            Print / Save as PDF
          </button>
        </div>
      )}

      {/* Document Container */}
      <div className="border border-gray-200 rounded-xl p-8 print:border-none print:rounded-none print:p-0 print:shadow-none">
        {/* ─── HEADER ─── */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-gray-800">
          <div className="flex items-center gap-4">
            <Image
              src="/Flexsell%20Logo.png"
              alt={sellerInfo.storeName}
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-black tracking-tight uppercase text-gray-900">
              {documentTitle}
            </h1>
            <p className="text-xs font-mono font-bold mt-1 text-gray-700">
              {isInvoice ? "Invoice" : "Receipt"} #: {documentNumber}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Date: {order.date || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {order._id && (
              <p className="text-xs text-gray-500 mt-0.5">
                Order Ref: {order._id}
              </p>
            )}
          </div>
        </div>

        {/* ─── SELLER & BUYER INFO ─── */}
        <div className="grid grid-cols-2 gap-8 py-6 text-xs border-b border-gray-200">
          {/* Seller */}
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Sold By:
            </h3>
            <p className="font-bold text-gray-900 text-sm">{sellerInfo.storeName}</p>
            {sellerInfo.address && (
              <p className="text-gray-600 mt-1 leading-relaxed">{sellerInfo.address}</p>
            )}
            {sellerInfo.gstin && (
              <p className="font-mono font-bold text-gray-800 mt-1.5">
                GSTIN: {sellerInfo.gstin}
              </p>
            )}
            {sellerInfo.email && (
              <p className="text-gray-500 mt-1">Email: {sellerInfo.email}</p>
            )}
            {sellerInfo.phone && (
              <p className="text-gray-500">Phone: {sellerInfo.phone}</p>
            )}
          </div>

          {/* Buyer */}
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Bill To / Ship To:
            </h3>
            <p className="font-bold text-gray-900 text-sm">{order.customerName}</p>
            {customerId && (
              <p className="font-mono text-gray-700 mt-0.5">
                Client ID: <span className="font-bold text-gray-950">{customerId}</span>
              </p>
            )}
            {order.shippingAddress.company && (
              <p className="text-gray-600 font-semibold">{order.shippingAddress.company}</p>
            )}
            <p className="text-gray-600 mt-1 leading-relaxed">
              {order.shippingAddress.address}
              {order.shippingAddress.apartment && `, ${order.shippingAddress.apartment}`}
            </p>
            <p className="text-gray-600">
              {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
            </p>
            <p className="text-gray-500 mt-1">Phone: {order.shippingAddress.phone}</p>
            {order.shippingAddress.gstin && (
              <p className="font-mono font-bold text-emerald-700 mt-1.5">
                GSTIN: {order.shippingAddress.gstin}
              </p>
            )}
          </div>
        </div>

        {/* ─── ITEMS TABLE ─── */}
        <div className="py-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-gray-800 uppercase text-[10px] font-bold text-gray-500 tracking-wider">
                <th className="pb-3 w-[5%]">#</th>
                <th className="pb-3 w-[35%]">Description</th>
                <th className="pb-3 text-center w-[8%]">HSN</th>
                <th className="pb-3 text-center w-[8%]">Qty</th>
                <th className="pb-3 text-right w-[14%]">Unit Price</th>
                <th className="pb-3 text-center w-[8%]">GST %</th>
                <th className="pb-3 text-right w-[14%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => {
                const formattedVariants = Object.entries(item.selectedVariants || {})
                  .map(([key, val]) => `${key}: ${val}`)
                  .join(" • ");
                const hsn = item.product?.hsnCode ?? "3924";
                const gstRate = item.product?.gstRate ?? 18;
                const lineTotal = item.pricePerUnit * item.quantity;
                return (
                  <tr key={`${item.product?._id || index}-${index}`} className="border-b border-gray-100">
                    <td className="py-3 text-gray-500">{index + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {/* Dynamic Variant Image Preview */}
                        <div className="w-12 h-12 relative flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden">
                          {(() => {
                            const matchedProduct = products.find(p => p._id === item.productId || p._id === item.product?._id);
                            const productSource = matchedProduct || item.product;
                            const colorVariants = productSource?.colorVariants || [];
                            const matchingColor = item.selectedVariants?.["Color"] || item.selectedVariants?.["color"];
                            const activeVariant = colorVariants.find((cv: any) => cv.color === matchingColor)
                              || colorVariants[0];
                            const firstImg = activeVariant?.images?.[0];
                            const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
                            return (
                              <Image
                                src={imgUrl || "https://placehold.co/400x400/10b981/ffffff?text=Product"}
                                alt={item.product?.title || "Product"}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized
                              />
                            );
                          })()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.product?.title || "Product"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                            {(() => {
                              const matchingColor = item.selectedVariants?.["Color"] || item.selectedVariants?.["color"];
                              const activeVariant = item.product?.colorVariants?.find((cv: any) => cv.color === matchingColor)
                                || item.product?.colorVariants?.[0];
                              const activeSub = activeVariant?.subVariants?.[0];
                              const sku = activeSub?.sku || (item.product?._id ? `SKU-${item.product._id.slice(-6)}` : "SKU-N/A");
                              return <span>SKU: {sku}</span>;
                            })()}
                            {formattedVariants && <span>• {formattedVariants}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono text-gray-600">{hsn}</td>
                    <td className="py-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-3 text-right">₹{item.pricePerUnit.toFixed(2)}</td>
                    <td className="py-3 text-center">{gstRate}%</td>
                    <td className="py-3 text-right font-bold text-gray-900">₹{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── TAX & TOTALS ─── */}
        <div className="grid grid-cols-2 gap-8 border-t border-gray-200 pt-6">
          {/* HSN Summary */}
          <div>
            <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-3">
              HSN Tax Summary
            </h4>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase font-bold tracking-wider">
                  <th className="pb-2 text-left">HSN</th>
                  <th className="pb-2 text-right">Taxable</th>
                  {tax.isIntrastate ? (
                    <>
                      <th className="pb-2 text-right">CGST</th>
                      <th className="pb-2 text-right">SGST</th>
                    </>
                  ) : (
                    <th className="pb-2 text-right">IGST</th>
                  )}
                  <th className="pb-2 text-right">Tax Total</th>
                </tr>
              </thead>
              <tbody>
                {tax.hsnSlabs.map((slab) => (
                  <tr key={slab.hsnCode} className="border-b border-gray-100 text-gray-700">
                    <td className="py-1.5 font-mono font-semibold">{slab.hsnCode} ({slab.gstRate}%)</td>
                    <td className="py-1.5 text-right">₹{slab.baseAmount.toFixed(2)}</td>
                    {tax.isIntrastate ? (
                      <>
                        <td className="py-1.5 text-right">₹{slab.cgst.toFixed(2)}</td>
                        <td className="py-1.5 text-right">₹{slab.sgst.toFixed(2)}</td>
                      </>
                    ) : (
                      <td className="py-1.5 text-right">₹{slab.igst.toFixed(2)}</td>
                    )}
                    <td className="py-1.5 text-right font-bold">₹{slab.totalTax.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-2 text-xs print:bg-gray-50">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Base Value:</span>
              <span className="font-semibold">₹{tax.baseSubtotal.toFixed(2)}</span>
            </div>
            {tax.isIntrastate ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (Central Tax):</span>
                  <span>₹{tax.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST (State Tax):</span>
                  <span>₹{tax.sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-gray-600">
                <span>IGST (Integrated Tax):</span>
                <span>₹{tax.igst.toFixed(2)}</span>
              </div>
            )}
            {couponDiscount > 0 && (
              <div className="flex justify-between text-primary font-bold">
                <span>Coupon Discount ({order.couponCode || "Discount"}):</span>
                <span>-₹{couponDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Shipping & Cargo Handling:</span>
              <span className="font-semibold">
                {shippingCharge > 0 ? `₹${shippingCharge.toFixed(2)}` : "Free"}
              </span>
            </div>
            <div className="flex justify-between border-t-2 border-gray-800 pt-3 mt-3 font-bold text-base text-gray-900">
              <span>Grand Total (Incl. GST):</span>
              <span className="text-emerald-700 text-lg">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ─── PAYMENT & SIGNATORY ─── */}
        <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-dashed border-gray-300">
          {/* Payment Details */}
          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Payment Details:
            </h4>
            <p className="font-bold text-gray-900 bg-gray-100 inline-block px-3 py-1.5 rounded border border-gray-200">
              {order.paymentMethod === "COD"
                ? "Cash on Delivery (COD)"
                : order.paymentMethod === "Razorpay"
                  ? "Online Payment (UPI/Cards/Netbanking)"
                  : order.paymentMethod || "N/A"}
            </p>
            <p className="text-gray-600 mt-2">
              Status:{" "}
              <span className={`font-bold ${
                order.paymentStatus === "Paid" ? "text-emerald-700" :
                order.paymentStatus === "Failed" ? "text-red-600" :
                "text-amber-600"
              }`}>
                {order.paymentStatus || "Pending"}
              </span>
            </p>
            {order.transactionId && (
              <p className="text-gray-500 font-mono text-[11px] mt-1">
                Txn ID: {order.transactionId}
              </p>
            )}
          </div>

          {/* Authorized Signatory */}
          <div className="flex flex-col justify-between items-end">
            <div className="text-center w-56 border border-gray-300 p-4 rounded-lg bg-gray-50 relative">
              <div className="border border-emerald-300 border-dashed rounded text-[9px] font-bold text-emerald-600 px-2 py-1 rotate-[-4deg] absolute left-2 top-2 opacity-80 uppercase tracking-widest no-print">
                {sellerInfo.storeName} B2B Verified
              </div>
              <div className="h-16 flex items-center justify-center">
                <span className="text-[10px] text-gray-400 italic font-serif">
                  Authorized Signatory
                </span>
              </div>
              <div className="border-t border-gray-400 pt-2 font-bold text-[10px] text-gray-800 uppercase tracking-wider">
                For {sellerInfo.storeName}
              </div>
            </div>
          </div>
        </div>

        {/* ─── FOOTER NOTE ─── */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 text-center space-y-1">
          <p>This is a computer-generated {isInvoice ? "invoice" : "receipt"} and does not require a physical signature.</p>
          <p>© {new Date().getFullYear()} {sellerInfo.storeName}. All rights reserved.</p>
        </div>
      </div>

      {/* ─── PRINT STYLES ─── */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-document, .invoice-document * { visibility: visible; }
          .invoice-document {
            position: absolute; left: 0; top: 0; width: 100%;
            max-width: 100% !important; padding: 0 !important;
          }
          .no-print { display: none !important; }
          nav, header, footer, aside, [data-sidebar],
          .no-print, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
