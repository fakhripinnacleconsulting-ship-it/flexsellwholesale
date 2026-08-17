"use client";

import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Printer } from "lucide-react";
import { WalletReceiptDocument } from "./WalletReceiptDocument";
import type { WalletTransactionView } from "@/types/wallet";
import { useReactToPrint } from "react-to-print";

interface WalletReceiptDialogProps {
  transaction: WalletTransactionView | null;
  customerName: string;
  customerEmail?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletReceiptDialog({
  transaction,
  customerName,
  customerEmail,
  open,
  onOpenChange,
}: WalletReceiptDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Receipt-${transaction?.receiptNumber || 'Transaction'}`,
    suppressErrors: true,
    bodyClass: "printing-inline-document",
  });

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Transaction Receipt</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 print:p-0" ref={contentRef}>
          <div className="border rounded-md print:border-none print:rounded-none">
            <WalletReceiptDocument 
              transaction={transaction}
              customerName={customerName}
              customerEmail={customerEmail}
            />
          </div>
        </div>
        
        <DialogFooter className="print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => handlePrint()} className="gap-2">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
