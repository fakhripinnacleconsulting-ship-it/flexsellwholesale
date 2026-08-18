"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatPrice } from "@/lib/utils";
import { X, AlertCircle } from "lucide-react";

export type PayOnlineMethod = "UPI" | "Razorpay" | "Bank Transfer" | "Store Wallet" | "Business Wallet";

interface InvoicePayModalProps {
  isOpen: boolean;
  onClose: () => void;
  payInvoiceId: string | null;
  /** The receipt total. The server settles against its own stored copy; this is for the UI guard. */
  payAmount: number;
  paymentType: "cash" | "online";
  setPaymentType: (type: "cash" | "online") => void;
  onlineMethod: PayOnlineMethod;
  setOnlineMethod: (method: PayOnlineMethod) => void;
  txnId: string;
  setTxnId: (val: string) => void;
  onConfirmPay: () => void;
  isSubmitting?: boolean;
  walletBalance?: number;
  businessWalletBalance?: number;
}

export function InvoicePayModal({
  isOpen,
  onClose,
  payInvoiceId,
  payAmount,
  paymentType,
  setPaymentType,
  onlineMethod,
  setOnlineMethod,
  txnId,
  setTxnId,
  onConfirmPay,
  isSubmitting = false,
  walletBalance = 0,
  businessWalletBalance = 0,
}: InvoicePayModalProps) {
  if (!isOpen) return null;

  const isWallet = paymentType === "online" && (onlineMethod === "Store Wallet" || onlineMethod === "Business Wallet");
  const selectedBalance = onlineMethod === "Business Wallet" ? businessWalletBalance : walletBalance;

  /**
   * The wallet must actually cover the receipt.
   *
   * The server refuses a short balance with a 409 regardless — this only stops the request
   * being made at all. Previously the balance was fetched, rendered in the dropdown label,
   * and then never compared against anything, so a ₹0 wallet looked like a valid choice.
   */
  const walletCovers = !isWallet || selectedBalance >= payAmount;
  const shortfall = isWallet && !walletCovers ? payAmount - selectedBalance : 0;

  // A reference is mandatory for everything except a wallet, where the ledger entry is the
  // reference. The modal used to invent one when the field was blank.
  const needsReference = !isWallet;
  const referenceMissing = needsReference && !txnId.trim();

  const canConfirm = walletCovers && !referenceMissing && !isSubmitting;

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
          Collect <span className="font-bold text-foreground">{formatPrice(payAmount)}</span> against{" "}
          <span className="font-mono font-bold text-foreground">{payInvoiceId}</span>. This issues a new Tax
          Invoice with its own number and syncs the linked order.
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
                <div className="text-[11px] opacity-80 mt-0.5">UPI, Netbank, Wallet</div>
              </button>
            </div>
          </div>

          {paymentType === "online" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Online Gateway / Method</label>
              <select
                value={onlineMethod}
                onChange={(e) => setOnlineMethod(e.target.value as PayOnlineMethod)}
                className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md cursor-pointer"
              >
                <option value="UPI">UPI / VPA Scan</option>
                <option value="Bank Transfer">Direct Bank Wire / NEFT</option>
                <option value="Razorpay">Razorpay Gateway</option>
                <option value="Store Wallet">Store Wallet — {formatPrice(walletBalance)} available</option>
                <option value="Business Wallet">Business Wallet — {formatPrice(businessWalletBalance)} available</option>
              </select>
            </div>
          )}

          {isWallet && !walletCovers && (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md border border-amber-200 dark:border-amber-900">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{formatPrice(shortfall)} short for this receipt.</p>
                <p className="text-xs opacity-90 mt-0.5">
                  The {onlineMethod} holds {formatPrice(selectedBalance)} against a total of {formatPrice(payAmount)}.
                  Add funds or choose another method.
                </p>
              </div>
            </div>
          )}

          {needsReference && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Transaction Ref / UTR / Receipt No. <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={paymentType === "cash" ? "e.g. CASH-HAND-102" : "e.g. UTR984712034"}
                value={txnId}
                onChange={(e) => setTxnId(e.target.value)}
                className="text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Required — this is what the payment reconciles against.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={onClose} className="cursor-pointer" disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirmPay}
              disabled={!canConfirm}
              className="font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Recording…" : "Confirm Payment & Issue Invoice"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
