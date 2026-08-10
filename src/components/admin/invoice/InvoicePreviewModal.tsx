"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Printer, X } from "lucide-react";
import { Invoice, SellerInfo } from "@/types";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { CompanyInfoData } from "./CompanyInformationTab";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";

interface InvoicePreviewModalProps {
  selectedInvoice?: Invoice | null;
  order?: any | null;
  invoice?: Invoice | any | null;
  sellerInfo?: SellerInfo;
  companyInfo?: CompanyInfoData;
  onClose: () => void;
  onUpdateStatus?: (status: string) => void;
}

export function InvoicePreviewModal({
  selectedInvoice,
  order: providedOrder,
  invoice: providedInvoice,
  sellerInfo: providedSellerInfo,
  companyInfo,
  onClose,
  onUpdateStatus,
}: InvoicePreviewModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!selectedInvoice && !providedOrder) return null;

  const activeInvoice = selectedInvoice || providedInvoice;

  const type: "invoice" | "receipt" | "quote" = activeInvoice?.type ||
    (providedOrder?.paymentStatus === "Paid" ? "invoice" : "receipt");

  const documentNumber = activeInvoice?._id || providedOrder?._id || "DRAFT-PREVIEW";
  const customerName = activeInvoice?.customerName || providedOrder?.customerName || "";
  const customerId = activeInvoice?.customerId || (providedOrder as any)?.customerId;
  const customerType = (activeInvoice as any)?.customerType || (providedOrder as any)?.customerType;
  const salesperson = activeInvoice?.salesperson || (providedOrder as any)?.salesperson;

  const orderObj = providedOrder || (activeInvoice ? {
    _id: activeInvoice.orderId || "",
    date: activeInvoice.generatedAt,
    amount: activeInvoice.amount,
    status: "Processing",
    statusClass: "",
    itemsCount: activeInvoice.items.reduce((acc: number, item: any) => acc + item.quantity, 0),
    customerName: activeInvoice.customerName,
    customerType: (activeInvoice as any).customerType,
    priceTier: (activeInvoice as any).priceTier || (activeInvoice as any).customerType,
    shippingAddress: activeInvoice.shippingAddress,
    dropshipDetails: (activeInvoice as any).dropshipDetails,
    items: activeInvoice.items,
    history: [],
    paymentMethod: activeInvoice.paymentMethod as any,
    paymentStatus: activeInvoice.paymentStatus as any,
    transactionId: activeInvoice.transactionId,
    couponCode: activeInvoice.couponCode,
    couponDiscount: activeInvoice.couponDiscount,
    shippingCharge: (activeInvoice as any).shippingCharge,
  } : null);

  const fallbackCompany: CompanyInfoData = companyInfo || {
    storeName: "FlexSell Wholesale",
    legalName: "FlexSell Wholesale Sourcing Pvt Ltd",
    gstin: "23AAACD1234D1Z0",
    pan: "AAACD1234D",
    cin: "U74999MP2026PTC012345",
    companyAddress: "2nd floor, Sector B, Plot no 3, Main Rd, Kohefiza, Bhopal, Madhya Pradesh 462001",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pinCode: "462001",
    supportEmail: "support@flexsellwholesale.com",
    supportPhone: "+91 98765 43210",
    websiteUrl: "https://flexsellwholesale.com",
    signatureUrl: "",
    bankName: "HDFC Bank",
    accountName: "FlexSell Wholesale Sourcing Pvt Ltd",
    accountNumber: "50200012345678",
    ifscCode: "HDFC0001234",
    branchName: "Vijay Nagar Branch, Indore",
    termsAndConditions: [
      "Prices represent verified factory-direct wholesale pricing.",
      "Quote valid for 15 calendar days from generation date.",
      "Prices inclusive of GST as per Indian tax norms.",
      "Shipping charges calculated dynamically based on order weight/B2B flat rate.",
      "Subject to stock availability at time of order placement."
    ]
  };

  const sellerInfoData: any = providedSellerInfo || {
    storeName: activeInvoice?.sellerInfo?.storeName || fallbackCompany.storeName,
    legalName: activeInvoice?.sellerInfo?.legalName || fallbackCompany.legalName,
    gstin: activeInvoice?.sellerInfo?.gstin || fallbackCompany.gstin,
    pan: activeInvoice?.sellerInfo?.pan || fallbackCompany.pan,
    cin: activeInvoice?.sellerInfo?.cin || fallbackCompany.cin,
    address: activeInvoice?.sellerInfo?.address || fallbackCompany.companyAddress,
    email: activeInvoice?.sellerInfo?.email || fallbackCompany.supportEmail,
    phone: activeInvoice?.sellerInfo?.phone || fallbackCompany.supportPhone,
    signatureUrl: activeInvoice?.sellerInfo?.signatureUrl || fallbackCompany.signatureUrl,
    bankDetails: activeInvoice?.sellerInfo?.bankDetails || (
      ((activeInvoice?.paymentMethod || providedOrder?.paymentMethod) === "Bank Transfer" || type === "quote")
        ? {
            bankName: fallbackCompany.bankName,
            accountName: fallbackCompany.accountName,
            accountNumber: fallbackCompany.accountNumber,
            ifscCode: fallbackCompany.ifscCode,
            branchName: fallbackCompany.branchName
          }
        : undefined
    ),
    termsAndConditions: (activeInvoice?.sellerInfo?.termsAndConditions && activeInvoice.sellerInfo.termsAndConditions.length > 0)
      ? activeInvoice.sellerInfo.termsAndConditions
      : fallbackCompany.termsAndConditions
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:max-h-none print-preview-modal-wrapper print-portal-root">
      <div className="bg-background border rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden shadow-2xl flex flex-col relative print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:static print:block print:p-0 print:m-0">
        {/* Modal Header Bar */}
        <div className="p-4 border-b bg-background z-10 flex flex-wrap justify-between items-center gap-3 no-print">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Document Preview: <span className="font-mono text-primary">{documentNumber}</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">View, print, or manage status details of this document in standard A4 structure.</p>
          </div>

          <div className="flex items-center gap-2">
            {onUpdateStatus && activeInvoice?.type === "quote" && (
              <select
                value={activeInvoice.status}
                onChange={(e) => onUpdateStatus(e.target.value)}
                className="bg-background text-foreground text-xs font-semibold px-2 py-1.5 border rounded-md cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent to Buyer</option>
                <option value="finalized">Finalized</option>
                <option value="converted">Converted to Order</option>
              </select>
            )}

            <Button
              onClick={() => {
                const docLabel = type === "receipt" ? "RECEIPT" : type === "quote" ? "Quote" : "Invoice";
                triggerPrintWithTitle(docLabel, documentNumber, customerName);
              }}
              className="flex items-center gap-1.5 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-3 py-1.5 h-8.5"
            >
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8.5 w-8.5 p-0 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Modal Body / A4 Container */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 dark:bg-neutral-900 flex justify-center max-h-[80vh] w-full print:p-0 print:bg-white print:max-h-none print:h-auto print:overflow-visible print:overflow-y-visible print:block print:w-full print:m-0">
          <div data-print-area="true" className="print-container bg-white dark:bg-zinc-950 shadow-md border border-border w-full max-w-[794px] p-4 sm:p-6 md:p-8 rounded-xs select-text flex flex-col justify-between print:p-0 print:border-none print:shadow-none print:max-w-none print:block print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:m-0">
            <InvoiceDocument
              type={type}
              documentNumber={documentNumber}
              customerId={customerId}
              customerType={customerType}
              salesperson={salesperson}
              order={orderObj}
              sellerInfo={sellerInfoData}
              taxBreakdown={activeInvoice?.taxDetails}
              showActions={false}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
