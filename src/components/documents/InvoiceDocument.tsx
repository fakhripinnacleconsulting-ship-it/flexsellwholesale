"use client";

import * as React from "react";
import Image from "next/image";
import { formatPrice, sanitizeImgUrl } from "@/lib/utils";
import { Order, CartItem, TaxBreakdown, SellerInfo, HsnSlab } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";
import { Barcode } from "@/components/ui/Barcode";

export interface InvoiceDocumentProps {
  type: "invoice" | "receipt" | "quote" | "shipping_label";
  documentNumber?: string;
  order: Order | any;
  sellerInfo: SellerInfo;
  taxBreakdown?: TaxBreakdown;
  shipmentDetails?: {
    carrierName?: string;
    awbNumber?: string;
    dispatchType?: "PREPAID" | "COD";
    totalWeightKg?: number;
  };
  showActions?: boolean;
  customerId?: string;
  salesperson?: string;
}

function computeTaxBreakdown(order: Order, sellerState: string): TaxBreakdown {
  const buyerState = order.shippingAddress?.state || "Madhya Pradesh";
  const isIntrastate = buyerState.toLowerCase() === sellerState.toLowerCase();
  const hsnMap: Record<string, HsnSlab> = {};
  let baseSubtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  (order.items || []).forEach((item: any) => {
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
  shipmentDetails,
  showActions = true,
  customerId,
  salesperson,
}: InvoiceDocumentProps) {
  const { products } = useProductStore();
  const sellerStateMatch = sellerInfo.address.match(/(?:,\s*)([A-Za-z\s]+?)(?:\s*-\s*\d|$)/);
  const sellerState = sellerStateMatch ? sellerStateMatch[1].trim() : "Madhya Pradesh";
  const tax = providedTaxBreakdown || computeTaxBreakdown(order, sellerState);
  const isInvoice = type === "invoice";
  const isQuote = type === "quote";
  const isReceipt = type === "receipt";
  const isShippingLabel = type === "shipping_label";
  const grandTotal = order.amount || 0;

  const documentTitle = isShippingLabel
    ? "Shipping Dispatch Label"
    : isQuote
    ? "Price Quote"
    : isInvoice
    ? "Tax Invoice"
    : "Payment Receipt";

  const itemsList = order.items || [];
  const itemTotalWithGst = itemsList.reduce((sum: number, item: any) => sum + (item.pricePerUnit * item.quantity), 0);
  const couponDiscount = order.couponDiscount || 0;
  const rawShipping = (order.amount || 0) - itemTotalWithGst + couponDiscount;
  const shippingCharge = rawShipping > 0.01 ? parseFloat(rawShipping.toFixed(2)) : 0;

  const handlePrint = () => {
    const docLabel = isShippingLabel
      ? "Shipping_Label"
      : isInvoice
      ? "Invoice"
      : isReceipt
      ? "RECEIPT"
      : "Quote";
    const refId = documentNumber && documentNumber !== "DRAFT-PREVIEW" ? documentNumber : order._id;
    triggerPrintWithTitle(docLabel, refId);
  };

  if (isShippingLabel) {
    const isCod = shipmentDetails?.dispatchType === "COD" || order.paymentMethod === "COD";
    const trackingCode = shipmentDetails?.awbNumber || documentNumber || order._id;
    const carrierTitle = shipmentDetails?.carrierName || "FLEXSELL IN-HOUSE TRANSPORT DISPATCH";
    const totalWeightGrams = itemsList.reduce((acc: number, item: any) => {
      const wg = item.weightGrams || 250;
      return acc + wg * (item.quantity || 1);
    }, 0);
    const totalWeightKg = (totalWeightGrams / 1000).toFixed(2);
    const totalUnitsCount = itemsList.reduce((a: number, c: any) => a + (c.quantity || 1), 0);

    const formattedDate = order.date
      ? new Date(order.date).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()
      : new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase();

    return (
      <div className="invoice-document shipping-label-printable bg-white text-black max-w-2xl mx-auto print:w-full print:max-w-none print:m-0 print:p-0 print:overflow-visible print:bg-white select-text">
        {showActions && (
          <div className="no-print flex justify-end gap-3 mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg shadow cursor-pointer transition-colors"
            >
              Print Shipping Label
            </button>
          </div>
        )}

        <div
          data-print-area="true"
          className="invoice-document print-container border-2 border-black bg-white text-black p-5 sm:p-7 rounded-none font-sans space-y-4 print:border-2 print:border-black print:m-0 print:p-5 print:w-full"
        >
          <div className="border-b-2 border-black pb-3 flex justify-between items-start">
            <div className="space-y-1">
              <Image
                src="/Flexsell%20Logo.png"
                alt={sellerInfo.legalName || sellerInfo.storeName || "FlexSell Logo"}
                width={140}
                height={40}
                style={{ width: "auto", height: "auto", maxHeight: "32px", maxWidth: "140px" }}
                className="h-8 max-h-8 max-w-[140px] w-auto object-contain shrink-0 document-logo print-logo"
                unoptimized
              />
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight uppercase border-b-2 border-black inline-block pb-0.5 mt-1 text-black">
                {sellerInfo.legalName || sellerInfo.storeName || "FLEXSELL WHOLESALE SOURCING PVT LTD"}
              </h1>
              <p className="text-[10px] font-bold tracking-widest uppercase text-gray-700">
                B2B WHOLESALE ORDER DISPATCH
              </p>
            </div>

            <div className="text-right">
              <div className="inline-block px-3 py-1.5 bg-black text-white font-black text-xs uppercase tracking-wider">
                {isCod ? "C.O.D. ORDER" : "PREPAID ORDER"}
              </div>
              <p className="text-xs font-mono font-bold mt-1.5 text-black">Order #: {order._id}</p>
            </div>
          </div>

          <div className="border-b-2 border-black pb-3 text-center bg-white pt-1">
            <div className="flex justify-between items-center mb-2 text-[11px] font-extrabold uppercase text-black px-1">
              <span>CARRIER: {carrierTitle}</span>
              <span>DATE: {formattedDate}</span>
            </div>

            <div className="flex flex-col items-center justify-center my-2">
              <Barcode
                value={trackingCode}
                width={2}
                height={48}
                displayValue={false}
                className="border-none p-0 bg-transparent shadow-none"
              />
              <span className="font-mono font-extrabold text-sm sm:text-base tracking-widest mt-1.5 uppercase text-black">
                *{trackingCode}*
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 text-xs">
            <div className="space-y-1.5 pr-3 border-r-2 border-black">
              <div className="bg-black text-white font-black text-[10px] uppercase px-2 py-0.5 inline-block tracking-wider">
                SHIP TO (DELIVERY DOCK)
              </div>
              {order.shippingAddress?.company ? (
                <>
                  <p className="font-black text-base uppercase leading-tight text-black mt-1">
                    {order.shippingAddress.company}
                  </p>
                  <p className="font-bold text-xs text-gray-900">
                    Attn: {order.customerName || order.shippingAddress?.firstName}
                  </p>
                </>
              ) : (
                <p className="font-black text-base uppercase leading-tight text-black mt-1">
                  {order.customerName || "TECHNOLOGIES"}
                </p>
              )}
              {order.shippingAddress && (
                <>
                  <p className="font-semibold text-xs leading-snug text-gray-900 mt-1">
                    {order.shippingAddress.address}
                    {order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ""}
                  </p>
                  <p className="font-black text-xs uppercase text-black mt-1">
                    {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
                  </p>
                  <p className="font-mono font-black text-xs pt-1 text-black">
                    Ph: {order.shippingAddress.phone}
                  </p>
                  {order.shippingAddress.gstin && (
                    <p className="font-mono font-bold text-[10px] text-gray-800">
                      GSTIN: {order.shippingAddress.gstin}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1.5 pl-3">
              <div className="border border-black bg-white text-black font-black text-[10px] uppercase px-2 py-0.5 inline-block tracking-wider">
                RETURN / SHIP FROM (ORIGIN)
              </div>
              <p className="font-black text-xs uppercase text-black mt-1">
                {sellerInfo.legalName || sellerInfo.storeName || "FLEXSELL WHOLESALE SOURCING PVT LTD"}
              </p>
              <p className="text-[11px] leading-snug text-gray-900">{sellerInfo.address}</p>
              <p className="font-mono font-black text-xs text-black mt-1">Ph: {sellerInfo.phone}</p>
              {sellerInfo.gstin && <p className="font-mono text-[10px] text-gray-800">GSTIN: {sellerInfo.gstin}</p>}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center bg-gray-100 p-2.5 border-2 border-black font-extrabold text-xs text-black">
              <span>Total Units: {totalUnitsCount} Items</span>
              <span>Est Weight: {totalWeightKg} kg</span>
              <span>Decl Value: ₹{(order.amount || 0).toLocaleString()}</span>
            </div>

            <div className="border-2 border-black">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-gray-200 border-b-2 border-black font-extrabold uppercase text-black">
                  <tr>
                    <th className="p-2 border-r border-black">Item Description</th>
                    <th className="p-2 text-center border-r border-black">Variant</th>
                    <th className="p-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black font-semibold text-black">
                  {itemsList.slice(0, 4).map((item: any, i: number) => {
                    const formattedVariants = Object.entries(item.selectedVariants || {})
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(" • ");
                    return (
                      <tr key={i}>
                        <td className="p-2 font-bold truncate max-w-[200px] border-r border-black">
                          {item.product?.title || "Product Item"}
                        </td>
                        <td className="p-2 text-center text-gray-800 border-r border-black">
                          {formattedVariants || "Standard"}
                        </td>
                        <td className="p-2 text-right font-black">{item.quantity}</td>
                      </tr>
                    );
                  })}
                  {itemsList.length > 4 && (
                    <tr>
                      <td colSpan={3} className="p-1.5 text-center italic text-gray-700 bg-gray-50 font-bold">
                        + {itemsList.length - 4} additional SKU items listed in commercial invoice
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t-2 border-black pt-2.5 flex justify-between items-center text-[10px] text-gray-900 uppercase font-black">
            <span>VERIFIED FLEXSELL B2B ORDER DISPATCH</span>
            <span>HANDLE WITH CARE • KEEP DRY</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="invoice-document bg-white text-gray-900 max-w-4xl mx-auto print:w-full print:max-w-none print:m-0 print:p-0 print:overflow-visible print:bg-white">
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
      <div data-print-area="true" className="invoice-document print-container border border-gray-200 rounded-xl p-8 print:border-none print:rounded-none print:p-0 print:shadow-none print:w-full print:max-w-none print:overflow-visible">
        {/* ─── HEADER ─── */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-gray-800">
          <div className="flex items-center gap-4">
            <Image
              src="/Flexsell%20Logo.png"
              alt={sellerInfo.legalName || sellerInfo.storeName || "FlexSell Logo"}
              width={160}
              height={48}
              style={{ width: "auto", height: "auto", maxHeight: "40px", maxWidth: "160px" }}
              className="h-10 max-h-10 max-w-[160px] w-auto object-contain document-logo print-logo"
              unoptimized
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-black tracking-tight uppercase text-gray-900">
              {documentTitle}
            </h1>
            <p className="text-xs font-mono font-bold mt-1 text-gray-700">
              {isShippingLabel ? "AWB" : isQuote ? "Quote" : isInvoice ? "Invoice" : "Receipt"} #: {documentNumber || order._id}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Date: {order.date || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            {isQuote && (
              <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                Valid for 15 calendar days
              </p>
            )}
            {order._id && !isShippingLabel && (
              <p className="text-xs text-gray-500 mt-0.5">
                Order Ref: {order._id}
              </p>
            )}
            {salesperson && (
              <p className="text-xs font-medium text-emerald-700 mt-1">
                Sales Rep: <span className="font-bold text-gray-900">{salesperson}</span>
              </p>
            )}
          </div>
        </div>

        {/* ─── SELLER & BUYER INFO ─── */}
        <div className="grid grid-cols-2 gap-8 py-6 text-xs border-b border-gray-200">
          {/* Seller */}
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              {isQuote ? "Issued By:" : "Sold By / Shipper:"}
            </h3>
            <p className="font-bold text-gray-900 text-sm">{sellerInfo.legalName || sellerInfo.storeName}</p>
            {sellerInfo.legalName && sellerInfo.storeName && sellerInfo.legalName !== sellerInfo.storeName && (
              <p className="text-[11px] text-gray-500 font-medium">({sellerInfo.storeName})</p>
            )}
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
              {isQuote ? "Quotation For:" : "Bill To / Consignee:"}
            </h3>
            {order.shippingAddress?.company ? (
              <>
                <p className="font-bold text-gray-900 text-sm">{order.shippingAddress.company}</p>
                <p className="text-xs text-gray-700 font-medium">Attn: {order.customerName}</p>
              </>
            ) : (
              <p className="font-bold text-gray-900 text-sm">{order.customerName}</p>
            )}
            {customerId && (
              <p className="font-mono text-gray-700 mt-0.5">
                Client ID: <span className="font-bold text-gray-950">{customerId}</span>
              </p>
            )}
            {order.shippingAddress && (
              <>
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
              </>
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
              {itemsList.map((item: any, index: number) => {
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
                        {/* Dynamic Variant Image Preview with guaranteed fallback */}
                        <div className="w-12 h-12 relative flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden">
                          {(() => {
                            const matchedProduct = products.find(p => p._id === item.productId || p._id === item.product?._id);
                            const productSource = matchedProduct || item.product;
                            const colorVariants = productSource?.colorVariants || [];
                            const { color: matchingColor } = resolveVariantKeys(item.selectedVariants);
                            const activeVariant = colorVariants.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase())
                              || colorVariants[0];
                            const firstImg = activeVariant?.images?.[0]
                              || colorVariants.find((cv: any) => cv.images && cv.images.length > 0)?.images?.[0]
                              || (productSource as any)?.images?.[0]
                              || (item as any)?.image
                              || (item as any)?.imageUrl;
                            const rawUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
                            const imgUrl = sanitizeImgUrl(rawUrl, "/Flexsell%20Logo.png");
                            return (
                              <img
                                src={imgUrl}
                                alt={item.product?.title || "Product"}
                                className="w-12 h-12 object-cover"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.onerror = null;
                                  target.src = "/Flexsell%20Logo.png";
                                }}
                              />
                            );
                          })()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{item.product?.title || "Product"}</p>
                          {formattedVariants && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{formattedVariants}</p>
                          )}
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
              <span>Shipping & Order Delivery:</span>
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

            {order.paymentStatus === "Paid" ? (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-xs space-y-1">
                <p className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider flex items-center gap-1">
                  ✓ Payment Settled & Verified
                </p>
                <p className="text-gray-700">Payment Mode: <strong className="font-semibold">{order.paymentMethod || "Bank Transfer"}</strong></p>
                {order.transactionId && (
                  <p className="text-gray-700 font-mono">Reference / Txn ID: <strong className="font-semibold">{order.transactionId}</strong></p>
                )}
              </div>
            ) : (
              <>
                {(order.paymentMethod === "Bank Transfer" || order.paymentMethod === "NEFT/RTGS" || order.paymentMethod === "Cheque" || !order.paymentMethod) && sellerInfo.bankDetails?.accountNumber && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded text-xs space-y-1">
                    <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wider">Direct Bank Transfer Details:</p>
                    <p className="text-gray-700">Bank: <strong className="font-semibold">{sellerInfo.bankDetails.bankName}</strong></p>
                    <p className="text-gray-700">Account Name: <strong className="font-semibold">{sellerInfo.bankDetails.accountName}</strong></p>
                    <p className="text-gray-700 font-mono">A/C No: <strong className="font-semibold">{sellerInfo.bankDetails.accountNumber}</strong></p>
                    <p className="text-gray-700 font-mono">IFSC Code: <strong className="font-semibold">{sellerInfo.bankDetails.ifscCode}</strong></p>
                    {sellerInfo.bankDetails.branchName && (
                      <p className="text-gray-500 text-[10px]">Branch: {sellerInfo.bankDetails.branchName}</p>
                    )}
                  </div>
                )}

                {order.paymentMethod === "UPI" && sellerInfo.upiDetails?.upiId && (
                  <div className="mt-3 p-3 bg-emerald-50/50 border border-emerald-200 rounded text-xs space-y-1">
                    <p className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider">UPI / VPA Payment Details:</p>
                    <p className="text-gray-700 font-mono">UPI ID: <strong className="font-semibold text-emerald-700">{sellerInfo.upiDetails.upiId}</strong></p>
                    {sellerInfo.upiDetails.payeeName && (
                      <p className="text-gray-700">Payee Name: <strong>{sellerInfo.upiDetails.payeeName}</strong></p>
                    )}
                  </div>
                )}

                {order.paymentMethod === "COD" && (
                  <div className="mt-3 p-3 bg-amber-50/50 border border-amber-200 rounded text-xs space-y-1">
                    <p className="font-bold text-amber-800 text-[10px] uppercase tracking-wider">Cash on Delivery Instructions:</p>
                    <p className="text-amber-900 text-[11px]">Pay cash to logistics agent upon delivery.</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Authorized Signatory */}
          <div className="flex flex-col justify-between items-end">
            <div className="text-center w-56 border border-gray-300 p-4 rounded-lg bg-gray-50 relative">
              <div className="border border-emerald-300 border-dashed rounded text-[9px] font-bold text-emerald-600 px-2 py-1 rotate-[-4deg] absolute left-2 top-2 opacity-80 uppercase tracking-widest no-print">
                {sellerInfo.storeName} B2B Verified
              </div>
              <div className="h-16 flex items-center justify-center pt-2">
                {sellerInfo.signatureUrl ? (
                  <img
                    src={sellerInfo.signatureUrl}
                    alt="Authorized Signatory Signature"
                    className="h-14 max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] text-gray-400 italic font-serif">
                    Authorized Signatory
                  </span>
                )}
              </div>
              <div className="border-t border-gray-400 pt-2 font-bold text-[10px] text-gray-800 uppercase tracking-wider mt-1">
                For {sellerInfo.storeName}
              </div>
            </div>
          </div>
        </div>

        {/* ─── TERMS & CONDITIONS ─── */}
        {sellerInfo.termsAndConditions && sellerInfo.termsAndConditions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200 text-xs">
            <h4 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">
              Terms & Conditions / Policies:
            </h4>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-gray-600">
              {sellerInfo.termsAndConditions.map((term, idx) => (
                <li key={idx}>{term}</li>
              ))}
            </ol>
          </div>
        )}

        {/* ─── FOOTER NOTE ─── */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-[10px] text-gray-400 text-center space-y-1">
          <p>This is a computer-generated {isQuote ? "quotation" : isInvoice ? "invoice" : "receipt"} and does not require a physical signature.</p>
          <p>© {new Date().getFullYear()} {sellerInfo.legalName || sellerInfo.storeName}. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
