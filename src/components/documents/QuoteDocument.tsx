"use client";

import * as React from "react";
import Image from "next/image";
import { CartItem, TaxBreakdown, SellerInfo, HsnSlab } from "@/types";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { sanitizeImgUrl } from "@/lib/utils";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";

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
  const handlePrint = () => {
    triggerPrintWithTitle("Quote", quoteId);
  };

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
            {salesperson && (
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                Sales Rep: <span className="font-bold text-gray-900">{salesperson}</span>
              </p>
            )}
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
            <p className="text-gray-500">Domestic order delivery across India</p>
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
            {salesperson && (
              <p className="text-xs text-emerald-700 font-medium mt-1.5 pt-1.5 border-t border-gray-100">
                Salesperson: <span className="font-bold text-gray-900">{salesperson}</span>
              </p>
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
                
                const { color: matchingColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(item.selectedVariants);
                const activeVariant = item.product?.colorVariants?.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase())
                  || item.product?.colorVariants?.[0];
                const activeSub = activeVariant?.subVariants?.find((sv: any) =>
                  (!selectedSize || sv.size?.toLowerCase() === selectedSize.toLowerCase()) &&
                  (!selectedWeight || sv.weight?.toLowerCase() === selectedWeight.toLowerCase())
                ) || activeVariant?.subVariants?.[0];
                const sku = activeSub?.sku || (item.product?._id ? `SKU-${item.product._id.slice(-6)}` : "SKU-N/A");

                // Extract image with fallback across all color variants
                const firstImg = activeVariant?.images?.[0] || item.product?.colorVariants?.find((cv: any) => cv.images && cv.images.length > 0)?.images?.[0];
                const rawUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
                const imgUrl = sanitizeImgUrl(rawUrl, "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80");

                return (
                  <tr key={`${item.product?._id || index}-${index}`} className="border-b border-gray-100 text-xs">
                    <td className="py-3 px-1 text-gray-500 font-mono align-top">{index + 1}</td>
                    <td className="py-3 px-2 align-top">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden mt-0.5">
                          <img
                            src={imgUrl}
                            alt={item.product?.title || "Product"}
                            className="w-12 h-12 object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.onerror = null;
                              target.src = "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80";
                            }}
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
          <div>
            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest mb-2">
              Quote Terms & Conditions:
            </h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-600 italic leading-relaxed text-[11px]">
              {sellerInfo.termsAndConditions && sellerInfo.termsAndConditions.length > 0 ? (
                sellerInfo.termsAndConditions.map((term, idx) => (
                  <li key={idx}>{term}</li>
                ))
              ) : (
                <>
                  <li>Prices represent verified factory-direct wholesale pricing.</li>
                  <li>Quote valid for 15 calendar days from generation date.</li>
                  <li>Prices inclusive of GST as per Indian tax norms.</li>
                  <li>
                    {shippingCharge > 0 ? (
                      "Shipping charges calculated dynamically based on order weight/B2B flat rate."
                    ) : (
                      "Free delivery for wholesale volume orders."
                    )}
                  </li>
                  <li>Subject to stock availability at time of order placement.</li>
                </>
              )}
            </ol>

            {sellerInfo.bankDetails?.accountNumber && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs space-y-1 not-italic">
                <p className="font-bold text-gray-800 text-[10px] uppercase tracking-wider">Direct Bank Payment Details:</p>
                <p className="text-gray-700">Bank: <strong className="font-semibold">{sellerInfo.bankDetails.bankName}</strong></p>
                <p className="text-gray-700">Account Name: <strong className="font-semibold">{sellerInfo.bankDetails.accountName}</strong></p>
                <p className="text-gray-700 font-mono">A/C No: <strong className="font-semibold">{sellerInfo.bankDetails.accountNumber}</strong></p>
                <p className="text-gray-700 font-mono">IFSC Code: <strong className="font-semibold">{sellerInfo.bankDetails.ifscCode}</strong></p>
                {sellerInfo.bankDetails.branchName && (
                  <p className="text-gray-500 text-[10px]">Branch: {sellerInfo.bankDetails.branchName}</p>
                )}
              </div>
            )}
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
              <span>Shipping (B2B Flat Rate):</span>
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
        <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-end text-xs">
          <div className="text-gray-400">
            Authorized Distributor • {sellerInfo.storeName} B2B Sourcing
          </div>
          <div className="flex flex-col items-center">
            {sellerInfo.signatureUrl && (
              <img
                src={sellerInfo.signatureUrl}
                alt="Authorized Signatory Signature"
                className="h-14 max-w-full object-contain mb-1"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="border-t border-gray-400 pt-1 text-[11px] font-bold text-gray-800 text-center w-48 uppercase tracking-wider">
              Authorized Signatory
            </div>
            <div className="text-[10px] text-gray-500 font-semibold text-center">
              For {sellerInfo.storeName}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-[10px] text-gray-400 text-center">
          <p>© {new Date().getFullYear()} {sellerInfo.storeName}. All rights reserved.</p>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            background: #ffffff !important;
            overflow: visible !important;
          }
          body * { visibility: hidden; }
          .quote-document, .quote-document * { visibility: visible !important; }
          .quote-document {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          nav, header, footer, aside, [data-sidebar], .no-print, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
