"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { InvoiceDocument } from "./InvoiceDocument";
import { Order, SellerInfo } from "@/types";
import { X, Printer } from "lucide-react";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";

import { buildSellerInfo } from "@/lib/buildSellerInfo";

export interface ShippingLabelDocumentProps {
  order: Order;
  sellerInfo?: SellerInfo;
  onClose?: () => void;
}

export function ShippingLabelDocument({ order, sellerInfo: propSellerInfo, onClose }: ShippingLabelDocumentProps) {
  const [mounted, setMounted] = React.useState(false);
  const [cmsSellerInfo, setCmsSellerInfo] = React.useState<SellerInfo | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!propSellerInfo) {
      fetch("/api/cms")
        .then((r) => (r.ok ? r.json() : null))
        .then((cmsData) => {
          if (cmsData) {
            setCmsSellerInfo(buildSellerInfo(cmsData));
          }
        })
        .catch(() => {});
    }
  }, [propSellerInfo]);

  const seller = propSellerInfo || cmsSellerInfo || buildSellerInfo(null);

  const shipment = order.shipmentDetails || {
    type: "self",
    trackingId: `FLEX-${order._id}`,
    carrierName: "FlexSell In-House Transport",
  };

  const awbCode = shipment.trackingId || order._id;

  const handlePrint = () => {
    triggerPrintWithTitle("Shipping_Label", awbCode, order.customerName);
  };

  const documentContent = (
    <InvoiceDocument
      type="shipping_label"
      documentNumber={awbCode}
      order={order}
      sellerInfo={seller}
      shipmentDetails={{
        carrierName: shipment.carrierName,
        awbNumber: awbCode,
        dispatchType: order.paymentMethod === "COD" ? "COD" : "PREPAID",
      }}
      showActions={false}
    />
  );

  // If onClose is provided, render as an isolated portal modal attached to document.body
  if (onClose) {
    if (!mounted) return null;

    const modalContent = (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block print:w-full print:h-auto print:overflow-visible print:max-h-none print-preview-modal-wrapper print-portal-root">
        <div className="bg-background border rounded-xl max-w-3xl w-full max-h-[95dvh] overflow-hidden shadow-2xl flex flex-col relative print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:h-auto print:static print:block print:p-0 print:m-0">
          {/* Modal Header Controls (Hidden on Print) */}
          <div className="p-4 border-b bg-background z-10 flex justify-between items-center no-print">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Shipping Label Preview: <span className="font-mono text-primary">{awbCode}</span>
              </h2>
              <p className="text-[11px] text-muted-foreground">Print official A4 dispatch label for carrier delivery.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print Shipping Label
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground p-2 rounded-lg border border-border cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Modal Printable Body Container */}
          <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 dark:bg-neutral-900 flex justify-center max-h-[85dvh] w-full print:p-0 print:bg-white print:max-h-none print:h-auto print:overflow-visible print:block print:w-full print:m-0">
            <div data-print-area="true" className="print-container bg-white dark:bg-zinc-950 shadow-md border border-border w-full max-w-[700px] p-6 rounded-xs select-text print:p-0 print:border-none print:shadow-none print:max-w-none print:block print:w-full print:m-0">
              {documentContent}
            </div>
          </div>
        </div>
      </div>
    );

    return createPortal(modalContent, document.body);
  }

  return documentContent;
}
