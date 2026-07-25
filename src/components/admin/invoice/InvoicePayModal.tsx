"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { X } from "lucide-react";

interface InvoicePayModalProps {
  isOpen: boolean;
  onClose: () => void;
  payInvoiceId: string | null;
  payInvoiceType: "invoice" | "receipt" | "quote";
  paymentType: "cash" | "online";
  setPaymentType: (type: "cash" | "online") => void;
  onlineMethod: "UPI" | "Razorpay" | "Bank Transfer";
  setOnlineMethod: (method: "UPI" | "Razorpay" | "Bank Transfer") => void;
  txnId: string;
  setTxnId: (val: string) => void;
  onConfirmPay: () => void;
}

export function InvoicePayModal({
  isOpen,
  onClose,
  payInvoiceId,
  payInvoiceType,
  paymentType,
  setPaymentType,
  onlineMethod,
  setOnlineMethod,
  txnId,
  setTxnId,
  onConfirmPay,
}: InvoicePayModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl p-6 relative">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-foreground">Receive Payment</h3>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground mb-4">
          Mark document <span className="font-mono font-bold text-foreground">{payInvoiceId}</span> as Paid.
          This will convert the receipt to a Tax Invoice and sync payment details onto the linked order.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType("cash")}
                className={`p-3 border rounded-lg text-left transition-all cursor-pointer ${
                  paymentType === "cash"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-secondary/5 text-muted-foreground"
                }`}
              >
                <div className="text-sm font-bold">💵 Cash Payment</div>
                <div className="text-[11px] opacity-80 mt-0.5">Counter / Hand Cash</div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentType("online")}
                className={`p-3 border rounded-lg text-left transition-all cursor-pointer ${
                  paymentType === "online"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border hover:bg-secondary/5 text-muted-foreground"
                }`}
              >
                <div className="text-sm font-bold">💳 Online / Bank</div>
                <div className="text-[11px] opacity-80 mt-0.5">UPI, Netbank, Cards</div>
              </button>
            </div>
          </div>

          {paymentType === "online" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Online Gateway / Method</label>
              <select
                value={onlineMethod}
                onChange={(e) => setOnlineMethod(e.target.value as any)}
                className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md cursor-pointer"
              >
                <option value="UPI">UPI / VPA Scan</option>
                <option value="Bank Transfer">Direct Bank Wire / NEFT</option>
                <option value="Razorpay">Razorpay Gateway</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Transaction Ref / UTR / Receipt No.
            </label>
            <Input
              placeholder={paymentType === "cash" ? "e.g. CASH-HAND-102" : "e.g. UTR984712034"}
              value={txnId}
              onChange={(e) => setTxnId(e.target.value)}
              className="text-sm font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer">
              Cancel
            </Button>
            <Button size="sm" onClick={onConfirmPay} className="font-semibold cursor-pointer">
              Confirm Payment & Issue Invoice
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
