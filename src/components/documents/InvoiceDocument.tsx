"use client";

import * as React from "react";
import Image from "next/image";
import { formatPrice, sanitizeImgUrl } from "@/lib/utils";
import { Order, CartItem, TaxBreakdown, SellerInfo, HsnSlab } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";
import { Barcode } from "@/components/ui/Barcode";
import { shippingService } from "@/services/shippingService";
import { useAuthStore } from "@/stores/authStore";

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
  customerType?: string;
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
  customerType,
  salesperson,
}: InvoiceDocumentProps) {
  const { products, initializeProducts } = useProductStore();
  const { customer, manager } = useAuthStore();
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    if (!products || products.length === 0) {
      initializeProducts();
    }
    shippingService.getConfig()
      .then((cfg: any) => setShippingConfig(cfg))
      .catch((err: any) => console.error("Failed to load shipping config in InvoiceDocument:", err));
  }, [products, initializeProducts]);

  const isDropshipping =
    customerType === "Dropshipping" ||
    (order as any).customerType === "Dropshipping" ||
    (order as any).priceTier === "Dropshipping" ||
    (order as any).customerTypes?.includes("Dropshipping") ||
    (order as any).orderType === "Dropshipping" ||
    (order as any).items?.some((i: any) => i.priceTier === "Dropshipping" || i.customerType === "Dropshipping");

  const getItemShippingCharge = (item: any): number => {
    if (typeof item.shippingCharge === "number" && item.shippingCharge > 0) {
      return item.shippingCharge;
    }
    if (!isDropshipping) return 0;

    try {
      const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");
      const { parseWeightToGrams } = require("@/lib/shippingHelper");

      const pId = item.productId || (typeof item.product === "object" ? item.product?._id : item.product);
      const matchedProduct = products.find(p => p._id === pId || p.title?.toLowerCase() === (item.product?.title || item.title || "").toLowerCase());
      const productSource = matchedProduct || (typeof item.product === "object" ? item.product : null);

      const colorVariants = productSource?.colorVariants || [];
      const { color: matchingColor } = resolveVariantKeys(item.selectedVariants || item.variants || {});
      const activeVariant = colorVariants.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase())
        || colorVariants[0];

      const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
        (!item.selectedVariants?.["Size"] || sv.size === item.selectedVariants["Size"]) &&
        (!item.selectedVariants?.["Weight"] || sv.weight === item.selectedVariants["Weight"])
      ) || activeVariant?.subVariants?.[0];

      const itemWeightStr = item.weight || activeSubVariant?.weight || "500g";
      const actualUnitWeightGrams =
        item.weightGrams ??
        activeSubVariant?.weightGrams ??
        ((itemWeightStr !== "N/A" ? parseWeightToGrams(itemWeightStr) : 500) || 500);

      const effectiveUnitWeight = calculateEffectiveUnitWeightGrams(
        actualUnitWeightGrams,
        activeVariant?.lengthCm,
        activeVariant?.breadthCm,
        activeVariant?.heightCm,
        activeVariant?.dimensions
      );

      const slabs = shippingConfig?.weightSlabs || [];
      const unitRate = calculateShippingByWeight(effectiveUnitWeight, slabs);
      const qty = Number(item.quantity || 1);
      return unitRate * qty;
    } catch {
      return 80 * Number(item.quantity || 1);
    }
  };

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
  const explicitShipping = typeof (order as any).shippingCharge === "number" ? (order as any).shippingCharge : 0;
  const inferredShipping = (order.amount || 0) - itemTotalWithGst + couponDiscount;
  const shippingCharge = explicitShipping > 0 ? explicitShipping : (inferredShipping > 0.01 ? parseFloat(inferredShipping.toFixed(2)) : 0);

  const accountTypeLabel = (() => {
    const rawType = (
      customerType ||
      (order as any)?.customerType ||
      (order as any)?.orderType ||
      (order as any)?.priceTier ||
      (order as any)?.items?.[0]?.priceTier ||
      (order as any)?.items?.[0]?.customerType ||
      ""
    ).toString().toUpperCase();

    if (rawType.includes("DROP")) return "Dropshipping Account";
    if (rawType.includes("B2C") || rawType.includes("RETAIL")) return "B2C Account";
    if (rawType.includes("B2B") || rawType.includes("WHOLESALE") || rawType.includes("STANDARD") || rawType.includes("VIP")) return "B2B Account";
    if ((order as any)?.shippingAddress?.gstin || (order as any)?.shippingAddress?.company) return "B2B Account";
    return "B2C Account";
  })();

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
                priority={true}
              />
              <h1 className="text-sm sm:text-base font-extrabold tracking-tight uppercase border-b-2 border-black inline-block pb-0.5 mt-1 text-black">
                {sellerInfo.legalName || sellerInfo.storeName || "FLEXSELL WHOLESALE SOURCING PVT LTD"}
              </h1>
              <p className="text-[10px] font-bold tracking-widest uppercase text-gray-700">
                {accountTypeLabel.toUpperCase()} DISPATCH
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
                  {(order.shippingAddress.email || (order as any).customerEmail) && (
                    <p className="font-mono font-black text-xs pt-0.5 text-black">
                      Email: {order.shippingAddress.email || (order as any).customerEmail}
                    </p>
                  )}
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
                    const pId = item.productId || (typeof item.product === "object" ? item.product?._id : item.product);
                    const matchedProduct = products.find(p => p._id === pId || p.title?.toLowerCase() === (item.product?.title || item.productTitle || item.title || "").toLowerCase());
                    const productSource = matchedProduct || (typeof item.product === "object" ? item.product : null);

                    const colorVariants = productSource?.colorVariants || [];
                    const { color: matchingColor, size: matchingSize, weight: matchingWeight } = resolveVariantKeys(item.selectedVariants || item.variants || {});
                    const activeVariant = colorVariants.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase()) || colorVariants[0];
                    const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
                      (!matchingSize || sv.size === matchingSize) &&
                      (!matchingWeight || sv.weight === matchingWeight)
                    ) || activeVariant?.subVariants?.[0];

                    const resolvedSku =
                      item.sku ||
                      item.product?.sku ||
                      activeSubVariant?.sku ||
                      activeVariant?.sku ||
                      productSource?.sku ||
                      "N/A";

                    const rawTitle = item.productTitle || item.product?.title || item.title || "Product Item";
                    const truncatedTitle = rawTitle.length > 50 ? `${rawTitle.slice(0, 50)}...` : rawTitle;

                    const formattedVariants = Object.entries(item.selectedVariants || {})
                      .map(([key, val]) => `${key}: ${val}`)
                      .join(" • ");
                    return (
                      <tr key={i}>
                        <td className="p-2 border-r border-black" title={rawTitle}>
                          <div className="font-bold">{truncatedTitle}</div>
                          <div className="text-[9px] font-mono text-gray-700 font-semibold mt-0.5">SKU: {resolvedSku}</div>
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
    <div className="invoice-document bg-white text-gray-900 max-w-[794px] mx-auto print:w-full print:max-w-none print:m-0 print:p-0 print:overflow-visible print:bg-white">
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
      <div data-print-area="true" className="invoice-document print-container border border-gray-200 rounded-xl p-6 sm:p-8 print:border-none print:rounded-none print:p-0 print:shadow-none print:w-full print:max-w-none print:overflow-visible">
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
              priority={true}
            />
          </div>
          <div className="text-right">
            <h1 className="text-xl font-black tracking-tight uppercase text-gray-900">
              {documentTitle}
            </h1>
            <p className="text-xs font-semibold text-gray-800 mt-1">
              Account Type: <span className="font-extrabold uppercase bg-gray-100 text-gray-900 px-2 py-0.5 rounded border border-gray-300 print:bg-gray-100 print:text-gray-900">{accountTypeLabel}</span>
            </p>
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
            <p className="text-xs font-medium text-gray-700 mt-0.5">
              Account Type: <span className="font-bold text-gray-950">{accountTypeLabel}</span>
            </p>
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
                {(order.shippingAddress.email || (order as any).customerEmail) && (
                  <p className="text-gray-500">Email: {order.shippingAddress.email || (order as any).customerEmail}</p>
                )}
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
                <th className={`pb-3 ${isDropshipping ? "w-[4%]" : "w-[5%]"}`}>#</th>
                <th className={`pb-3 ${isDropshipping ? "w-[28%]" : "w-[35%]"}`}>Description</th>
                <th className="pb-3 text-center w-[8%]">HSN</th>
                <th className="pb-3 text-center w-[6%]">Qty</th>
                <th className={`pb-3 text-right ${isDropshipping ? "w-[15%]" : "w-[14%]"}`}>
                  {isDropshipping ? "Product Price" : "Unit Price"}
                </th>
                <th className="pb-3 text-center w-[7%]">GST %</th>
                {isDropshipping && (
                  <th className="pb-3 text-right w-[16%] text-emerald-700 font-bold">Line Shipping</th>
                )}
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
                const itemShippingCost = getItemShippingCharge(item);
                const unitShippingCost = itemShippingCost / (item.quantity || 1);
                return (
                  <tr key={`${item.product?._id || index}-${index}`} className="border-b border-gray-100">
                    <td className="py-3 text-gray-500">{index + 1}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {/* Dynamic Variant Image Preview with guaranteed fallback */}
                        <div className="w-12 h-12 relative flex-shrink-0 bg-gray-50 border border-gray-200 rounded overflow-hidden">
                          {(() => {
                            const pId = item.productId || (typeof item.product === "object" ? item.product?._id : item.product);
                            const matchedProduct = products.find(p => p._id === pId || p.title?.toLowerCase() === (item.product?.title || item.title || "").toLowerCase());
                            const productSource = matchedProduct || (typeof item.product === "object" ? item.product : null);
                            
                            const colorVariants = productSource?.colorVariants || [];
                            const { color: matchingColor } = resolveVariantKeys(item.selectedVariants || item.variants || {});
                            const activeVariant = colorVariants.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase())
                              || colorVariants[0];

                            const extractUrl = (img: any): string => {
                              if (!img) return "";
                              if (typeof img === "string") return img;
                              return img.url || "";
                            };

                            const candidateImages = [
                              extractUrl(activeVariant?.images?.[0]),
                              extractUrl(colorVariants.find((cv: any) => cv.images && cv.images.length > 0)?.images?.[0]),
                              extractUrl(productSource?.images?.[0]),
                              extractUrl((productSource as any)?.featuredImage),
                              extractUrl((productSource as any)?.image),
                              extractUrl((productSource as any)?.imageUrl),
                              extractUrl((item as any)?.image),
                              extractUrl((item as any)?.imageUrl),
                              extractUrl((item as any)?.productImage),
                              extractUrl((item as any)?.featuredImage),
                            ].filter(Boolean);

                            const firstImg = candidateImages[0] || "";
                            const imgUrl = sanitizeImgUrl(firstImg, "/Flexsell%20Logo.png");
                            return (
                              <img
                                src={imgUrl}
                                alt={item.product?.title || item.title || "Product"}
                                className="w-12 h-12 object-cover rounded"
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
                          {(() => {
                            const pId = item.productId || (typeof item.product === "object" ? item.product?._id : item.product);
                            const matchedProduct = products.find(p => p._id === pId || p.title?.toLowerCase() === (item.product?.title || item.productTitle || item.title || "").toLowerCase());
                            const productSource = matchedProduct || (typeof item.product === "object" ? item.product : null);

                            const colorVariants = productSource?.colorVariants || [];
                            const { color: matchingColor, size: matchingSize, weight: matchingWeight } = resolveVariantKeys(item.selectedVariants || item.variants || {});
                            const activeVariant = colorVariants.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase()) || colorVariants[0];
                            const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
                              (!matchingSize || sv.size === matchingSize) &&
                              (!matchingWeight || sv.weight === matchingWeight)
                            ) || activeVariant?.subVariants?.[0];

                            const resolvedSku =
                              item.sku ||
                              item.product?.sku ||
                              activeSubVariant?.sku ||
                              activeVariant?.sku ||
                              productSource?.sku ||
                              "N/A";

                            const fullTitle = item.productTitle || item.product?.title || item.title || "Product";
                            const truncatedTitle = fullTitle.length > 50 ? `${fullTitle.slice(0, 50)}...` : fullTitle;

                            return (
                              <>
                                <p className="font-bold text-gray-900" title={fullTitle}>{truncatedTitle}</p>
                                <p className="text-[10px] font-mono text-gray-600 font-semibold mt-0.5">SKU: {resolvedSku}</p>
                              </>
                            );
                          })()}
                          {formattedVariants && (
                            <p className="text-[10px] text-gray-500 mt-0.5">{formattedVariants}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center font-mono text-gray-600">{hsn}</td>
                    <td className="py-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-3 text-right">
                      <span className="font-bold text-gray-900 block">₹{item.pricePerUnit.toFixed(2)}</span>
                      {isDropshipping && (
                        <span className="text-[9px] text-emerald-700 block font-semibold">
                          + ₹{unitShippingCost.toFixed(2)} ship/unit
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center">{gstRate}%</td>
                    {isDropshipping && (
                      <td className="py-3 text-right">
                        <span className="font-mono text-emerald-700 font-bold block">
                          ₹{itemShippingCost.toFixed(2)}
                        </span>
                        <span className="text-[9px] text-gray-500 block">
                          ({item.quantity} × ₹{unitShippingCost.toFixed(2)})
                        </span>
                      </td>
                    )}
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
              <span>{isDropshipping ? "Total Dropshipping Shipping Charge:" : "Shipping & Order Delivery:"}</span>
              <span className="font-semibold text-emerald-700 font-bold">
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
          {(manager || customer) && (
            <p className="mt-1 opacity-70">
              Document Generated by: {(manager?.name || customer?.name) || "User"} ({(manager?.email || customer?.email) || "Unknown"})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
