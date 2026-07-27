"use client";

import * as React from "react";
import { QuoteDocument } from "@/components/documents/QuoteDocument";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { SellerInfo } from "@/types";
import { resolvePrice } from "@/lib/priceTierHelper";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { useSearchParams } from "next/navigation";

function QuoteContent() {
  const searchParams = useSearchParams();
  const salespersonParam = searchParams.get("salesperson") || undefined;
  const { items, buyerState, hydrateProducts } = useCartStore();
  const { products, initializeProducts } = useProductStore();
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    if (products.length === 0) {
      initializeProducts();
    } else {
      hydrateProducts();
    }
  }, [products.length, initializeProducts, hydrateProducts]);

  React.useEffect(() => {
    fetch("/api/cms")
      .then(res => res.json())
      .then(data => setCmsData(data))
      .catch((err: unknown) => console.error("Failed to load CMS data:", err));

    const { shippingService } = require("@/services/shippingService");
    shippingService.getConfig()
      .then((config: any) => setShippingConfig(config))
      .catch((err: unknown) => console.error("Failed to load shipping config:", err));
  }, []);

  const b2bItems = React.useMemo(() => {
    return items.map((item) => {
      const liveProduct = products.find(p => p._id === item.productId || p._id === item.product?._id) || item.product;
      const { color: matchingColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(item.selectedVariants);

      const activeVariant = liveProduct?.colorVariants?.find((cv: any) => cv.color?.toLowerCase() === matchingColor?.toLowerCase())
        || liveProduct?.colorVariants?.[0];
      const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
        (!selectedSize || sv.size?.toLowerCase() === selectedSize.toLowerCase()) &&
        (!selectedWeight || sv.weight?.toLowerCase() === selectedWeight.toLowerCase())
      ) || activeVariant?.subVariants?.[0];

      const b2bUnitPrice = activeSubVariant ? resolvePrice(activeSubVariant, "B2B") : item.pricePerUnit;

      return {
        ...item,
        product: liveProduct,
        priceTier: "B2B" as const,
        pricePerUnit: b2bUnitPrice,
      };
    });
  }, [items, products]);

  const taxDetails = React.useMemo(() => {
    const isIntrastate = (buyerState || "Madhya Pradesh") === "Madhya Pradesh";
    const hsnBreakdown: Record<string, any> = {};

    let baseSubtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;

    b2bItems.forEach((item) => {
      const p = products.find(prod => prod._id === (item.productId || item.product?._id)) || item.product;
      const rate = p?.gstRate ?? 18;
      const hsn = p?.hsnCode ?? "3924";
      const isIncl = p?.priceIncludesGst ?? true;
      const totalAmount = item.pricePerUnit * item.quantity;

      let itemBase = 0;
      let itemTax = 0;

      if (isIncl) {
        itemBase = totalAmount / (1 + rate / 100);
        itemTax = totalAmount - itemBase;
      } else {
        itemBase = totalAmount;
        itemTax = totalAmount * (rate / 100);
      }

      baseSubtotal += itemBase;
      grandTotal += (itemBase + itemTax);

      if (isIntrastate) {
        totalCgst += (itemTax / 2);
        totalSgst += (itemTax / 2);
      } else {
        totalIgst += itemTax;
      }

      if (!hsnBreakdown[hsn]) {
        hsnBreakdown[hsn] = {
          hsnCode: hsn,
          gstRate: rate,
          baseAmount: 0,
          totalTax: 0,
          cgst: 0,
          sgst: 0,
          igst: 0
        };
      }

      hsnBreakdown[hsn].baseAmount += itemBase;
      hsnBreakdown[hsn].totalTax += itemTax;
      if (isIntrastate) {
        hsnBreakdown[hsn].cgst += (itemTax / 2);
        hsnBreakdown[hsn].sgst += (itemTax / 2);
      } else {
        hsnBreakdown[hsn].igst += itemTax;
      }
    });

    return {
      isIntrastate,
      baseSubtotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      hsnSlabs: Object.values(hsnBreakdown).map((slab: any) => ({
        hsnCode: slab.hsnCode,
        gstRate: slab.gstRate,
        baseAmount: slab.baseAmount,
        totalTax: slab.totalTax,
        cgst: slab.cgst,
        sgst: slab.sgst,
        igst: slab.igst
      }))
    };
  }, [b2bItems, buyerState, products]);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-foreground bg-background min-h-screen flex flex-col justify-center items-center">
        <h1 className="text-xl font-bold mb-2">No Items Found</h1>
        <p className="text-muted-foreground">Add products to your wholesale cart to generate a B2B quote.</p>
      </div>
    );
  }

  const bs = cmsData?.businessSettings || {};
  const sellerInfo: SellerInfo = {
    storeName: bs.storeName || "FlexSell Wholesale",
    gstin: bs.gstin || "24AAACF1001M1Z5",
    address: bs.companyAddress || "Plot No. 12, GIDC Industrial Estate, Sachin, Bhopal, Gujarat - 394230",
    email: bs.supportEmail || "support@flexsell.in",
    phone: bs.supportPhone || "+91 261 2409000",
  };

  const quoteId = `Q-${Math.floor(Math.random() * 900000 + 100000)}`;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 print:bg-white print:py-0 print:px-0">
      <QuoteDocument
        quoteId={quoteId}
        items={b2bItems}
        taxDetails={taxDetails}
        buyerState={buyerState || "Madhya Pradesh"}
        sellerInfo={sellerInfo}
        showActions={true}
        shippingConfig={shippingConfig}
        salesperson={salespersonParam}
      />
    </div>
  );
}

export default function QuotePage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center">Loading quote...</div>}>
      <QuoteContent />
    </React.Suspense>
  );
}
