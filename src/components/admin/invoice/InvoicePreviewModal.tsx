"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Printer, X } from "lucide-react";
import { Invoice } from "@/types";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { CompanyInfoData } from "./CompanyInformationTab";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";

interface InvoicePreviewModalProps {
  selectedInvoice: Invoice | null;
  onClose: () => void;
  companyInfo: CompanyInfoData;
  onUpdateStatus?: (status: string) => void;
}

export function InvoicePreviewModal({
  selectedInvoice,
  onClose,
  companyInfo,
  onUpdateStatus,
}: InvoicePreviewModalProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!selectedInvoice || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static print:block print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:max-h-none print-preview-modal-wrapper print-portal-root">
      <div className="bg-background border rounded-xl max-w-4xl w-full max-h-[95vh] overflow-hidden shadow-2xl flex flex-col relative print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:static print:block print:p-0 print:m-0">
        {/* Modal Header Bar */}
        <div className="p-4 border-b bg-background z-10 flex flex-wrap justify-between items-center gap-3 no-print">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              Document Preview: <span className="font-mono text-primary">{selectedInvoice._id}</span>
            </h2>
            <p className="text-[11px] text-muted-foreground">View, print, or manage status details of this document in standard A4 structure.</p>
          </div>

          <div className="flex items-center gap-2">
            {onUpdateStatus && selectedInvoice.type === "quote" && (
              <select
                value={selectedInvoice.status}
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
                const docLabel = selectedInvoice?.type === "receipt" ? "RECEIPT" : selectedInvoice?.type === "quote" ? "Quote" : "Invoice";
                triggerPrintWithTitle(docLabel, selectedInvoice?._id, selectedInvoice?.customerName);
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
          <div data-print-area="true" className="print-container bg-white dark:bg-zinc-950 shadow-md border border-border w-full max-w-[800px] p-6 sm:p-10 md:p-14 rounded-xs select-text flex flex-col justify-between print:p-0 print:border-none print:shadow-none print:max-w-none print:block print:w-full print:h-auto print:overflow-visible print:overflow-y-visible print:m-0">
            <InvoiceDocument
              type={selectedInvoice.type}
              documentNumber={selectedInvoice._id}
              customerId={selectedInvoice.customerId}
              customerType={(selectedInvoice as any).customerType}
              salesperson={selectedInvoice.salesperson}
              order={{
                _id: selectedInvoice.orderId || "",
                date: selectedInvoice.generatedAt,
                amount: selectedInvoice.amount,
                status: "Processing",
                statusClass: "",
                itemsCount: selectedInvoice.items.reduce((acc, item) => acc + item.quantity, 0),
                customerName: selectedInvoice.customerName,
                customerType: (selectedInvoice as any).customerType,
                priceTier: (selectedInvoice as any).priceTier || (selectedInvoice as any).customerType,
                shippingAddress: selectedInvoice.shippingAddress,
                items: selectedInvoice.items,
                history: [],
                paymentMethod: selectedInvoice.paymentMethod as any,
                paymentStatus: selectedInvoice.paymentStatus as any,
                transactionId: selectedInvoice.transactionId,
                couponCode: selectedInvoice.couponCode,
                couponDiscount: selectedInvoice.couponDiscount,
                shippingCharge: (selectedInvoice as any).shippingCharge,
              }}
              sellerInfo={{
                storeName: selectedInvoice.sellerInfo?.storeName || companyInfo.storeName,
                legalName: selectedInvoice.sellerInfo?.legalName || companyInfo.legalName,
                gstin: selectedInvoice.sellerInfo?.gstin || companyInfo.gstin,
                pan: selectedInvoice.sellerInfo?.pan || companyInfo.pan,
                cin: selectedInvoice.sellerInfo?.cin || companyInfo.cin,
                address: selectedInvoice.sellerInfo?.address || companyInfo.companyAddress,
                email: selectedInvoice.sellerInfo?.email || companyInfo.supportEmail,
                phone: selectedInvoice.sellerInfo?.phone || companyInfo.supportPhone,
                signatureUrl: selectedInvoice.sellerInfo?.signatureUrl || companyInfo.signatureUrl,
                bankDetails: selectedInvoice.sellerInfo?.bankDetails || (
                  (selectedInvoice.paymentMethod === "Bank Transfer" || selectedInvoice.type === "quote")
                    ? {
                        bankName: companyInfo.bankName,
                        accountName: companyInfo.accountName,
                        accountNumber: companyInfo.accountNumber,
                        ifscCode: companyInfo.ifscCode,
                        branchName: companyInfo.branchName
                      }
                    : undefined
                ),
                termsAndConditions: (selectedInvoice.sellerInfo?.termsAndConditions && selectedInvoice.sellerInfo.termsAndConditions.length > 0)
                  ? selectedInvoice.sellerInfo.termsAndConditions
                  : companyInfo.termsAndConditions
              }}
              taxBreakdown={selectedInvoice.taxDetails}
              showActions={false}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
