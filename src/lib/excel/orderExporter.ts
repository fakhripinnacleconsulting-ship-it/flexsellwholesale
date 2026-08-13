import { Order } from "@/stores/orderStore";

export async function exportOrdersToExcel(orders: Order[]) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Orders");

  // Define 51 columns in exact logical sequence
  ws.columns = [
    // 1. Order Basic Info
    { header: "Order ID", key: "_id", width: 25 },
    { header: "Date", key: "createdAt", width: 20 },
    { header: "Order Type", key: "orderType", width: 15 },
    { header: "Order Status", key: "status", width: 15 },
    { header: "Order Origin", key: "origin", width: 15 },

    // 2. Registered Client / Buyer Info
    { header: "Customer Name", key: "customerName", width: 25 },
    { header: "Customer Email", key: "customerEmail", width: 25 },
    { header: "Customer Phone", key: "customerPhone", width: 18 },
    { header: "Customer GSTIN", key: "customerGstin", width: 20 },
    { header: "Billing Street Address", key: "billingAddress", width: 35 },
    { header: "Billing City", key: "billingCity", width: 18 },
    { header: "Billing State", key: "billingState", width: 18 },
    { header: "Billing Pincode", key: "billingPinCode", width: 15 },

    // 3. Amazon Dropshipping Details (Shipment Info)
    { header: "Amazon Order ID", key: "amazonOrderId", width: 22 },
    { header: "Amazon Invoice Number", key: "amazonInvoiceId", width: 22 },
    { header: "Amazon Invoice Date", key: "amazonInvoiceDate", width: 18 },
    { header: "Dropship Customer Name", key: "dropshipCustomerName", width: 25 },
    { header: "Dropship Mobile Number", key: "dropshipMobileNumber", width: 18 },
    { header: "Dropship Email ID", key: "dropshipEmail", width: 25 },
    { header: "Dropship Delivery Date", key: "dropshipDeliveryDate", width: 18 },
    { header: "Dropship Shipping Address (Line 1)", key: "dropshipAddress", width: 35 },
    { header: "Dropship Address Line 2", key: "dropshipAddressLine2", width: 30 },
    { header: "Dropship City", key: "dropshipCity", width: 18 },
    { header: "Dropship State", key: "dropshipState", width: 18 },
    { header: "Dropship Pincode", key: "dropshipPincode", width: 15 },
    { header: "Amazon Tax Invoice (File Link)", key: "amazonTaxInvoice", width: 35 },
    { header: "Amazon Packaging Slip (File Link)", key: "amazonPackingSlip", width: 35 },

    // 4. Product Details
    { header: "Total Items Count", key: "totalItemsCount", width: 18 },
    { header: "Product Titles & Variants", key: "productTitlesAndVariants", width: 40 },
    { header: "Product SKUs", key: "productSkus", width: 25 },
    { header: "Product Dimensions", key: "productDimensions", width: 25 },
    { header: "Product Weight", key: "productWeight", width: 20 },
    { header: "Product Type (Category)", key: "productType", width: 25 },
    { header: "HSN Codes & GST Rates", key: "hsnAndGstRates", width: 25 },
    { header: "Quantities & Unit Prices", key: "quantitiesAndPrices", width: 30 },
    { header: "Complete Line Items Summary", key: "itemsSummary", width: 50 },

    // 5. Payment & Financial Details
    { header: "Total Amount (₹)", key: "amount", width: 18 },
    { header: "Base Subtotal (Taxable Value)", key: "baseSubtotal", width: 25 },
    { header: "CGST (₹)", key: "cgst", width: 15 },
    { header: "SGST (₹)", key: "sgst", width: 15 },
    { header: "IGST (₹)", key: "igst", width: 15 },
    { header: "Shipping Charge", key: "shippingCharge", width: 18 },
    { header: "Packaging Charge", key: "packagingCharge", width: 18 },
    { header: "Payment Method", key: "paymentMethod", width: 18 },
    { header: "Payment Status", key: "paymentStatus", width: 15 },
    { header: "Transaction Ref ID", key: "transactionId", width: 25 },
    { header: "Coupon Code", key: "couponCode", width: 15 },
    { header: "Coupon Discount", key: "couponDiscount", width: 18 },

    // 6. Sales Attributions & Courier Tracking
    { header: "Salesperson Name", key: "salesperson", width: 20 },
    { header: "Courier / Carrier Name", key: "carrierName", width: 20 },
    { header: "Tracking ID", key: "trackingId", width: 20 },
    { header: "Tracking URL", key: "trackingUrl", width: 35 },
  ];

  // Make header row bold & styled
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E293B" },
  };

  // Add data rows
  orders.forEach((order) => {
    const items = order.items || [];
    const totalItemsCount = items.reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);

    const productTitlesAndVariants = items
      .map(
        (i: any) =>
          `${i.productTitle || i.product?.title || "Item"} (${i.color || i.selectedVariants?.color || "Default"} / ${
            i.size || i.selectedVariants?.size || "Std"
          })`
      )
      .join("; ");

    const productSkus = items.map((i: any) => i.sku || i.productId || "N/A").join("; ");

    const productDimensions = items
      .map((i: any) => {
        const dim = i.dimensions || i.boxSize || i.product?.dimensions || i.product?.boxSize || i.selectedVariants?.dimensions || i.product?.colorVariants?.[0]?.dimensions;
        if (typeof dim === "object" && dim !== null) {
          return `${dim.length || 0}x${dim.width || dim.breadth || 0}x${dim.height || 0} cm`;
        }
        if (typeof dim === "string" && dim.trim()) return dim;
        const subSize = i.size || i.selectedVariants?.size || i.product?.colorVariants?.[0]?.subVariants?.[0]?.size;
        return subSize || "N/A";
      })
      .join("; ");

    const productWeight = items
      .map((i: any) => {
        const w = i.weight || i.selectedVariants?.weight || i.product?.weight || i.product?.colorVariants?.[0]?.subVariants?.[0]?.weight;
        return w ? (typeof w === "number" ? `${w}g` : w) : "N/A";
      })
      .join("; ");

    const dropship = (order as any).dropshipDetails || {};

    const getAbsoluteUrl = (url?: string) => {
      if (!url) return "";
      if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
      const baseUrl = typeof window !== "undefined"
        ? window.location.origin
        : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
      return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
    };

    const taxInvoiceUrl = getAbsoluteUrl(dropship.amazonTaxInvoice);
    const packingSlipUrl = getAbsoluteUrl(dropship.amazonPackingSlip);

    const formatLinkCell = (url?: string) => {
      if (!url) return "";
      return { text: url, hyperlink: url };
    };

    const productType = items
      .map((i: any) => {
        const cat = i.productType || i.product?.category || i.product?.categoryName || i.category;
        return cat || "General";
      })
      .join("; ");

    const hsnAndGstRates = items
      .map((i: any) => `HSN ${i.hsnCode || "3924"} (${i.gstRate || 18}%)`)
      .join("; ");

    const quantitiesAndPrices = items
      .map((i: any) => `${i.quantity} x ₹${i.pricePerUnit || i.price || 0}`)
      .join("; ");

    const itemsSummary = items
      .map(
        (i: any, index: number) =>
          `${index + 1}. ${i.productTitle || i.product?.title || "Item"} [Variant: ${
            i.color || i.selectedVariants?.color || "N/A"
          }, Size: ${i.size || i.selectedVariants?.size || "N/A"}] - Qty: ${i.quantity}, Price: ₹${
            i.pricePerUnit || i.price || 0
          }, SKU: ${i.sku || "N/A"} (HSN: ${i.hsnCode || "3924"}, GST: ${i.gstRate || 18}%)`
      )
      .join(" | ");

    const originStr = (order as any).origin || "website";
    const taxDetails = (order as any).taxDetails;

    let baseSubtotalVal = taxDetails?.baseSubtotal || 0;
    if (!baseSubtotalVal) {
      const itemsBase = items.reduce((sum: number, i: any) => {
        const qty = Number(i.quantity) || 1;
        const price = Number(i.pricePerUnit || i.price) || 0;
        return sum + (qty * price);
      }, 0);
      baseSubtotalVal = itemsBase > 0 ? itemsBase : Math.max(0, (order.amount || 0) - (order.shippingCharge || 0));
    }

    const cgstVal = taxDetails?.cgst || 0;
    const sgstVal = taxDetails?.sgst || 0;
    const igstVal = taxDetails?.igst || 0;

    ws.addRow({
      _id: order._id,
      createdAt: order.createdAt ? new Date(order.createdAt).toLocaleDateString() : order.date || "",
      orderType: order.orderType || "B2B",
      status: order.status || "Processing",
      origin: originStr,

      customerName: order.customerName || "",
      customerEmail: order.shippingAddress?.email || "",
      customerPhone: order.shippingAddress?.phone || "",
      customerGstin: order.shippingAddress?.gstin || "",
      billingAddress: order.shippingAddress?.address || "",
      billingCity: order.shippingAddress?.city || "",
      billingState: order.shippingAddress?.state || "",
      billingPinCode: order.shippingAddress?.pinCode || "",

      amazonOrderId: dropship.amazonOrderId || "",
      amazonInvoiceId: dropship.amazonInvoiceId || "",
      amazonInvoiceDate: dropship.amazonInvoiceDate || "",
      dropshipCustomerName: dropship.customerName || "",
      dropshipMobileNumber: dropship.mobileNumber || dropship.phone || "",
      dropshipEmail: dropship.email || "",
      dropshipDeliveryDate: dropship.deliveryDate || "",
      dropshipAddress: dropship.address || "",
      dropshipAddressLine2: dropship.addressLine2 || "",
      dropshipCity: dropship.city || "",
      dropshipState: dropship.state || "",
      dropshipPincode: dropship.pinCode || "",
      amazonTaxInvoice: formatLinkCell(taxInvoiceUrl),
      amazonPackingSlip: formatLinkCell(packingSlipUrl),

      totalItemsCount: `${items.length} items (${totalItemsCount} pcs)`,
      productTitlesAndVariants,
      productSkus,
      productDimensions,
      productWeight,
      productType,
      hsnAndGstRates,
      quantitiesAndPrices,
      itemsSummary,

      amount: order.amount || 0,
      baseSubtotal: baseSubtotalVal ? Number(baseSubtotalVal.toFixed(2)) : 0,
      cgst: cgstVal ? Number(cgstVal.toFixed(2)) : 0,
      sgst: sgstVal ? Number(sgstVal.toFixed(2)) : 0,
      igst: igstVal ? Number(igstVal.toFixed(2)) : 0,
      shippingCharge: order.shippingCharge || 0,
      packagingCharge: order.packagingCharge || 0,
      paymentMethod: order.paymentMethod || "N/A",
      paymentStatus: order.paymentStatus || "Pending",
      transactionId: order.transactionId || "",
      couponCode: order.couponCode || "",
      couponDiscount: order.couponDiscount || 0,

      salesperson: order.salesperson || "",
      carrierName: order.shipmentDetails?.carrierName || "",
      trackingId: order.shipmentDetails?.trackingId || "",
      trackingUrl: order.shipmentDetails?.trackingUrl || "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const now = new Date();
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  a.download = `flexsell_orders_${timestamp}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
