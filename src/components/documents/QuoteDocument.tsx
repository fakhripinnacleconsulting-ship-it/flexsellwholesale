"use client";

import * as React from "react";
import Image from "next/image";
import { CartItem, TaxBreakdown, SellerInfo, HsnSlab } from "@/types";

export interface QuoteDocumentProps {
  quoteId: string;
  items: CartItem[];
  taxDetails: TaxBreakdown;
  buyerState: string;
  sellerInfo: SellerInfo;
  showActions?: boolean;
  shippingConfig?: any;
}

export function QuoteDocument({
  quoteId,
  items,
  taxDetails,
  buyerState,
  sellerInfo,
  showActions = true,
  shippingConfig,
}: QuoteDocumentProps) {
  const handlePrint = () => window.print();

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const shippingCharge = React.useMemo(() => {
    if (!shippingConfig || items.length === 0) return 0;
    return shippingConfig?.b2bFixedCharge ?? 150;
  }, [items, shippingConfig]);

  const grandTotal = taxDetails.baseSubtotal + taxDetails.cgst + taxDetails.sgst + taxDetails.igst + shippingCharge;

  return (
    <div className="quote-document bg-white text-gray-900 max-w-4xl mx-auto">
      {/* Print Controls */}
      {showActions && (
        <div className="no-print flex justify-end gap-3 mb-6 pb-4 border-b border-gray-200">
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-lg shadow cursor-pointer transition-colors"
          >
            Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold py-2.5 px-5 rounded-lg cursor-pointer transition-colors"
          >
            Close Window
          </button>
        </div>
      )}

      {/* Document Container */}
      <div className="border border-gray-200 rounded-xl p-8 print:border-none print:rounded-none print:p-0 print:shadow-none relative">
        {/* ─── HEADER ─── */}
        <div className="flex justify-between items-start pb-6 border-b-2 border-gray-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Image
                src="/Flexsell%20Logo.png"
                alt={sellerInfo.storeName}
                width={160}
                height={48}
                className="h-10 w-auto object-contain"
                unoptimized
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {sellerInfo.address || "Wholesale Importers & B2B Distributors"}
            </p>
            {sellerInfo.gstin && (
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                GSTIN: {sellerInfo.gstin}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
              B2B Price Quote
            </h2>
            <p className="text-xs font-mono font-bold mt-1 text-gray-600">
              Quote ID: {quoteId}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Date: {dateStr}</p>
            <p className="text-[10px] text-amber-600 font-semibold mt-1">
              Valid for 15 days
            </p>
          </div>
        </div>

        {/* ─── BUYER / WAREHOUSE ─── */}
        <div className="grid grid-cols-2 gap-8 py-6 text-xs border-b border-gray-200">
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Quotation For:
            </h3>
            <p className="font-bold text-gray-800 text-sm">Wholesale Buyer</p>
            <p className="text-gray-500 mt-1">
              Delivery State: <strong className="text-gray-800">{buyerState}</strong>
            </p>
            <p className="text-gray-500">Domestic cargo delivery across India</p>
          </div>
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Issued By:
            </h3>
            <p className="font-semibold text-gray-800">{sellerInfo.storeName}</p>
            {sellerInfo.address && (
              <p className="text-gray-500 mt-1 leading-relaxed">{sellerInfo.address}</p>
            )}
            {sellerInfo.email && (
              <p className="text-gray-500 mt-1">Email: {sellerInfo.email}</p>
            )}
            {sellerInfo.phone && (
              <p className="text-gray-500">Phone: {sellerInfo.phone}</p>
            )}
          </div>
        </div>

        {/* ─── ITEMS TABLE ─── */}
        <div className="py-6">
          <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-3">
            Itemized Price Schedule:
          </h3>
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800 uppercase text-[10px] font-bold text-gray-500 tracking-wider">
                <th className="pb-3 px-1 w-[4%]">#</th>
                <th className="pb-3 px-2 w-[36%]">Description</th>
                <th className="pb-3 px-2 text-center w-[10%]">HSN</th>
                <th className="pb-3 px-2 text-center w-[10%]">Qty</th>
                <th className="pb-3 px-2 text-right w-[14%]">Unit Price</th>
                <th className="pb-3 px-2 text-center w-[10%]">GST Rate</th>
                <th className="pb-3 px-2 text-right w-[16%]">Total</th>
              </tr>
            </thead>
            <tbody>
               {items.map((item, index) => {
                const formattedVariants = Object.entries(item.selectedVariants || {})
                  .map(([key, val]) => `${key}: ${val}`)
                  .join(" • ");
                const gstRate = item.product?.gstRate ?? 18;
                const hsnCode = item.product?.hsnCode ?? "3924";
                const lineTotal = item.pricePerUnit * item.quantity;
                
                const matchingColor = item.selectedVariants?.["Color"] || item.selectedVariants?.["color"];
                const activeVariant = item.product?.colorVariants?.find((cv: any) => cv.color === matchingColor)
                  || item.product?.colorVariants?.[0];
                const activeSub = activeVariant?.subVariants?.[0];
                const sku = activeSub?.sku || (item.product?._id ? `SKU-${item.product._id.slice(-6)}` : "SKU-N/A");
                const firstImg = activeVariant?.images?.[0];
                const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";

                return (
                  <tr key={`${item.product?._id || index}-${index}`} className="border-b border-gray-100 text-xs">
                    <td className="py-3 px-1 text-gray-500 font-mono align-top">{index + 1}</td>
                    <td className="py-3 px-2 align-top">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 relative flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden mt-0.5">
                          <Image
                            src={imgUrl || "https://placehold.co/400x400/10b981/ffffff?text=Product"}
                            alt={item.product?.title || "Product"}
                            fill
                            sizes="48px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-gray-800 block leading-tight break-words">{item.product?.title || "Product"}</span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500 font-mono mt-1">
                            <span className="bg-gray-100 text-gray-700 px-1 py-0.2 rounded border border-gray-200">SKU: {sku}</span>
                            {formattedVariants && <span className="text-emerald-700 font-semibold">{formattedVariants}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-gray-600 font-semibold align-top whitespace-nowrap">{hsnCode}</td>
                    <td className="py-3 px-2 text-center font-bold align-top whitespace-nowrap">{item.quantity} units</td>
                    <td className="py-3 px-2 text-right align-top whitespace-nowrap">₹{item.pricePerUnit.toFixed(2)}</td>
                    <td className="py-3 px-2 text-center align-top whitespace-nowrap">{gstRate}%</td>
                    <td className="py-3 px-2 text-right font-bold text-gray-800 align-top whitespace-nowrap">₹{lineTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── SUMMARY ─── */}
        <div className="grid grid-cols-2 gap-8 pt-4 border-t border-gray-200">
          {/* Terms */}
          <div className="text-xs text-gray-500 space-y-2">
            <p className="font-bold uppercase text-[10px] text-gray-400 tracking-widest">
              Quote Terms & Conditions:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-gray-500 leading-relaxed italic">
              <li>Prices represent verified factory-direct wholesale pricing.</li>
              <li>Quote valid for 15 calendar days from generation date.</li>
              <li>Prices inclusive of GST as per Indian tax norms.</li>
              <li>
                {shippingCharge > 0 ? (
                  "Shipping charges calculated dynamically based on cargo weight/B2B flat rate."
                ) : (
                  "Free delivery for wholesale volume orders."
                )}
              </li>
              <li>Subject to stock availability at time of order placement.</li>
            </ol>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Base Value:</span>
              <span className="font-semibold">₹{taxDetails.baseSubtotal.toFixed(2)}</span>
            </div>
            {taxDetails.isIntrastate ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST (Central GST):</span>
                  <span>₹{taxDetails.cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST (State GST):</span>
                  <span>₹{taxDetails.sgst.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-gray-600">
                <span>IGST (Integrated GST):</span>
                <span>₹{taxDetails.igst.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between text-gray-600">
              <span>Shipping (B2B Cargo Flat Rate):</span>
              <span className="font-semibold">
                {shippingCharge > 0 ? `₹${shippingCharge.toFixed(2)}` : "Free Delivery"}
              </span>
            </div>

            {/* HSN Slabs */}
            {taxDetails.hsnSlabs.length > 0 && (
              <div className="border-t border-gray-200 pt-2 mt-2 space-y-1.5">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block">
                  HSN Summary
                </span>
                {taxDetails.hsnSlabs.map((slab) => (
                  <div key={slab.hsnCode} className="flex justify-between text-gray-600 border-b border-gray-100 pb-1">
                    <span>HSN {slab.hsnCode} ({slab.gstRate}%)</span>
                    <span>Tax: ₹{slab.totalTax.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between border-t-2 border-gray-800 pt-3 mt-3 font-bold text-base text-gray-900">
              <span>Grand Total (Incl. GST):</span>
              <span className="text-emerald-600 text-lg">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* ─── SIGNATURE ─── */}
        <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-center text-xs">
          <div className="text-gray-400">
            Authorized Distributor • {sellerInfo.storeName} B2B Sourcing
          </div>
          <div className="border-b-2 border-dotted border-gray-300 w-48 h-8" />
        </div>

        {/* Footer */}
        <div className="mt-6 text-[10px] text-gray-400 text-center">
          <p>© {new Date().getFullYear()} {sellerInfo.storeName}. All rights reserved.</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .quote-document, .quote-document * { visibility: visible; }
          .quote-document {
            position: absolute; left: 0; top: 0; width: 100%;
            max-width: 100% !important; padding: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
