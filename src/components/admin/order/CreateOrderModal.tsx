"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";
import { QuoteSelectorStep } from "./QuoteSelectorStep";
import { ConfirmOrderStep } from "./ConfirmOrderStep";
import { Invoice } from "@/types";
import { invoiceService } from "@/services/invoiceService";

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmOrder: (payload: {
    quoteId: string;
    salesperson?: string;
    paymentOption: "now" | "later";
    paymentMethod?: "Bank Transfer" | "Razorpay" | "UPI" | "COD";
    transactionId?: string;
  }) => Promise<void>;
  initialQuoteId: string | null;
}

export function CreateOrderModal({
  isOpen,
  onClose,
  onConfirmOrder,
  initialQuoteId,
}: CreateOrderModalProps) {
  const [confirmStep, setConfirmStep] = React.useState<"select-quote" | "confirm-order">("select-quote");
  const [selectedQuote, setSelectedQuote] = React.useState<Invoice | null>(null);
  const [loadingInitialQuote, setLoadingInitialQuote] = React.useState(false);

  // Handle initial quote id query parameters redirection
  React.useEffect(() => {
    if (isOpen) {
      if (initialQuoteId) {
        setLoadingInitialQuote(true);
        invoiceService
          .getInvoiceById(initialQuoteId)
          .then((q) => {
            if (q && q.type === "quote" && q.status !== "converted") {
              setSelectedQuote(q);
              setConfirmStep("confirm-order");
            } else {
              setSelectedQuote(null);
              setConfirmStep("select-quote");
            }
          })
          .catch((err) => {
            console.error("Failed to load redirect quote:", err);
            setSelectedQuote(null);
            setConfirmStep("select-quote");
          })
          .finally(() => {
            setLoadingInitialQuote(false);
          });
      } else {
        setSelectedQuote(null);
        setConfirmStep("select-quote");
      }
    }
  }, [isOpen, initialQuoteId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="p-6 border-b sticky top-0 bg-background z-10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {confirmStep === "select-quote" ? "Select Price Quote to Convert" : "Confirm B2B Commercial Order"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {confirmStep === "select-quote"
                ? "Choose an active wholesale quote to initiate pre-order validation and payment configuration."
                : "Review the cost breakdown, select payment mode, and authorize atomic stock deductions."}
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loadingInitialQuote ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Loading quote details, please wait...
          </div>
        ) : confirmStep === "select-quote" ? (
          <QuoteSelectorStep
            onSelectQuote={(q) => {
              setSelectedQuote(q);
              setConfirmStep("confirm-order");
            }}
            onClose={onClose}
          />
        ) : (
          selectedQuote && (
            <ConfirmOrderStep
              quote={selectedQuote}
              onBack={() => setConfirmStep("select-quote")}
              onConfirmOrder={onConfirmOrder}
            />
          )
        )}
      </div>
    </div>
  );
}
