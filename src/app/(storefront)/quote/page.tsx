"use client";

import * as React from "react";
import { QuoteDocument } from "@/components/documents/QuoteDocument";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { SellerInfo } from "@/types";

export default function QuotePage() {
  const { items, buyerState, getTaxDetails, hydrateProducts } = useCartStore();
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);

  React.useEffect(() => {
    const init = async () => {
      const productState = useProductStore.getState();
      if (productState.products.length === 0) {
        await productState.initializeProducts();
      }
      hydrateProducts();
    };
    init();

    fetch("/api/cms")
      .then(res => res.json())
      .then(data => setCmsData(data))
      .catch((err: unknown) => console.error("Failed to load CMS data:", err));

    const { shippingService } = require("@/services/shippingService");
    shippingService.getConfig()
      .then((config: any) => setShippingConfig(config))
      .catch((err: unknown) => console.error("Failed to load shipping config:", err));
  }, [hydrateProducts]);

  const b2bItems = React.useMemo(() => {
    const { resolvePrice } = require("@/lib/priceTierHelper");
    return items.map((item) => {
      const matchingColor = item.selectedVariants["Color"] || item.selectedVariants["color"];
      const activeVariant = item.product?.colorVariants?.find((cv: any) => cv.color === matchingColor)
        || item.product?.colorVariants?.[0];
      const activeSubVariant = activeVariant?.subVariants?.find((sv: any) =>
        (!item.selectedVariants["Size"] || sv.size === item.selectedVariants["Size"]) &&
        (!item.selectedVariants["Weight"] || sv.weight === item.selectedVariants["Weight"])
      ) || activeVariant?.subVariants?.[0];

      const b2bUnitPrice = activeSubVariant ? resolvePrice(activeSubVariant, "B2B") : item.pricePerUnit;

      return {
        ...item,
        priceTier: "B2B" as const,
        pricePerUnit: b2bUnitPrice,
      };
    });
  }, [items]);

  const taxDetails = React.useMemo(() => {
    const isIntrastate = (buyerState || "Madhya Pradesh") === "Madhya Pradesh";
    const hsnBreakdown: Record<string, any> = {};
    
    let baseSubtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let grandTotal = 0;

    const storeProducts = useProductStore.getState().products;

    b2bItems.forEach((item) => {
      const p = storeProducts.find(prod => prod._id === (item.productId || item.product?._id)) || item.product;
      const rate = p?.gstRate ?? 18;
      const hsn = p?.hsnCode ?? "3924";
      const isIncl = p?.priceIncludesGst ?? true;
      
      const unitPrice = item.pricePerUnit;
      const qty = item.quantity;
      const totalAmount = unitPrice * qty;

      let basePrice = unitPrice;
      let itemTax = 0;

      if (isIncl) {
        // Price includes GST
        basePrice = unitPrice / (1 + rate / 100);
        const itemBase = basePrice * qty;
        itemTax = totalAmount - itemBase;
        baseSubtotal += itemBase;
        grandTotal += totalAmount;
      } else {
        // Price excludes GST
        const itemBase = unitPrice * qty;
        itemTax = itemBase * (rate / 100);
        baseSubtotal += itemBase;
        grandTotal += (itemBase + itemTax);
      }

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isIntrastate) {
        cgst = itemTax / 2;
        sgst = itemTax / 2;
        totalCgst += cgst;
        totalSgst += sgst;
      } else {
        igst = itemTax;
        totalIgst += igst;
      }

      if (hsnBreakdown[hsn]) {
        hsnBreakdown[hsn].baseAmount += (basePrice * qty);
        hsnBreakdown[hsn].cgst += cgst;
        hsnBreakdown[hsn].sgst += sgst;
        hsnBreakdown[hsn].igst += igst;
        hsnBreakdown[hsn].totalTax += itemTax;
      } else {
        hsnBreakdown[hsn] = {
          hsnCode: hsn,
          gstRate: rate,
          baseAmount: (basePrice * qty),
          cgst,
          sgst,
          igst,
          totalTax: itemTax,
        };
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
  }, [b2bItems, buyerState]);

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-foreground bg-background min-h-screen flex flex-col justify-center items-center">
        <h1 className="text-xl font-bold mb-2">No Items Found</h1>
        <p className="text-muted-foreground">Add products to your wholesale cart to generate a B2B quote.</p>
      </div>
    );
  }

  const bs = cmsData?.brandSettings || {};
  const sellerInfo: SellerInfo = {
    storeName: bs.storeName || "FlexSell Wholesale",
    gstin: bs.gstin || "24AAACF1001M1Z5",
    address: bs.companyAddress || "Plot No. 12, GIDC Industrial Estate, Sachin, Surat, Gujarat - 394230",
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
      />
    </div>
  );
}
