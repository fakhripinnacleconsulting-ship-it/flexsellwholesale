"use client";

import * as React from "react";
import { openRazorpayCheckout } from "@/lib/razorpayLoader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { formatPrice } from "@/lib/utils";
import * as walletService from "@/services/walletService";
import { WALLET_TERMS_TEXT } from "@/lib/walletConstants";
import { X, ShieldAlert, Loader2 } from "lucide-react";
import type { WalletType } from "@/types/wallet";

interface AddMoneyDialogProps {
  walletType: WalletType;
  kycApproved: boolean;
  onClose: () => void;
  onCredited: () => void;
  /**
   * Admin-only: take an online payment on this customer's behalf.
   *
   * When set, the dialog is an assisted sale — the admin opens the checkout and the customer
   * pays on it. The copy shifts to the second person and the acknowledgement is recorded as
   * accepted by staff, because that is what actually happened.
   */
  onBehalfOf?: { userId: string; customerName: string };
  /**
   * When provided, the dialog offers a wallet selector.
   *
   * The staff panel opens this from one button rather than one per wallet, so the choice has
   * to live inside — matching how the expense and offline-funds dialogs already work. Absent
   * for customers, who arrive from a specific wallet card and have already chosen.
   */
  allowWalletChange?: (next: WalletType) => void;
}

const MIN = 500;
const MAX = 200000;
const QUICK = [1000, 5000, 10000, 25000];

/**
 * Adds money to a wallet.
 *
 * The two acknowledgements here are not UX polish — they are the record that answers a
 * dispute. Balance is non-refundable and staff may spend it without asking, so each
 * recharge carries its own timestamped acceptance rather than relying on a term the
 * customer agreed to once, months ago, against wording nobody kept.
 */
export function AddMoneyDialog({
  walletType,
  kycApproved,
  onClose,
  onCredited,
  onBehalfOf,
  allowWalletChange,
}: AddMoneyDialogProps) {
  const { addToast } = useToastStore();

  const isAssisted = Boolean(onBehalfOf);

  const [amount, setAmount] = React.useState("");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [kycAcknowledged, setKycAcknowledged] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const dialogRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);

  // Focus returns to whatever opened the dialog, so keyboard users are not dropped at the
  // top of the document when it closes.
  React.useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => triggerRef.current?.focus?.();
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, isSubmitting]);

  const needsKycAck = walletType === "business" && !kycApproved;
  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount >= MIN && numericAmount <= MAX;
  const canSubmit = amountValid && termsAccepted && (!needsKycAck || kycAcknowledged) && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      // No balance moves here. This records the intent and mints a Razorpay order from a
      // server-side amount, so a tampered page cannot buy ₹30,000 of balance for ₹1.
      const session = await walletService.initiateRecharge({
        walletType,
        amount: numericAmount,
        termsAccepted: true,
        kycWarningAccepted: needsKycAck ? true : undefined,
        userId: onBehalfOf?.userId,
      });

      await openRazorpayCheckout({
        key: session.keyId,
        amount: String(session.amount),
        currency: session.currency || "INR",
        name: "FlexSell Wholesale",
        description: walletType === "business" ? "Business Wallet top-up" : "Store Wallet top-up",
        order_id: session.razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            await walletService.verifyRecharge(response);
            addToast(isAssisted ? "Payment collected and credited." : "Money added to your wallet.", "success");
            onCredited();
          } catch {
            /**
             * The payment succeeded; only our confirmation call failed. Never tell the
             * customer their money is lost — the webhook settles independently, and the
             * lazy sweep credits it next time they open this page.
             */
            addToast(
              "Payment received. Your balance will update shortly.",
              "success"
            );
            onCredited();
          }
        },
        modal: {
          ondismiss: () => setIsSubmitting(false),
        },
        theme: { color: "#10b981" },
      } as unknown as Record<string, unknown>);
    } catch (err) {
      // Covers both a gateway that never loaded and a recharge that could not be started.
      // Nothing has been charged in either case, so one message serves both.
      addToast((err as Error).message || "Could not start the payment", "error");
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-money-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="add-money-title" className="text-base font-bold tracking-tight text-foreground">
              {isAssisted ? "Take an online payment" : "Add money"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {isAssisted
                ? `into ${onBehalfOf!.customerName}'s ${walletType === "business" ? "Business" : "Store"} Wallet`
                : `to your ${walletType === "business" ? "Business" : "Store"} Wallet`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/*
          Above the amount field, before any input — not below the button and not behind a
          link. A customer must know their money cannot come back *before* they decide how
          much to send.
        */}
        {needsKycAck && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-[11px] font-medium leading-relaxed text-amber-800 dark:text-amber-300">
              {isAssisted
                ? `${onBehalfOf!.customerName}'s KYC is pending. Funds can be added now, but services cannot begin until it is approved.`
                : "Your KYC is pending. You can add funds now, but services cannot begin until your KYC is approved."}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {allowWalletChange && (
            <div>
              <label htmlFor="wallet-target" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Which wallet
              </label>
              <select
                id="wallet-target"
                value={walletType}
                onChange={(e) => allowWalletChange(e.target.value as WalletType)}
                className="h-10 w-full cursor-pointer rounded-md border bg-background px-3 text-sm font-semibold text-foreground"
              >
                <option value="store">Store Wallet — products and services</option>
                <option value="business">Business Wallet — services only</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="wallet-amount" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Amount <span className="text-destructive">*</span>
            </label>
            <Input
              id="wallet-amount"
              type="number"
              inputMode="numeric"
              min={MIN}
              max={MAX}
              step={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(MIN)}
              className="text-lg font-bold tabular-nums"
              aria-describedby="wallet-amount-help"
            />
            <p id="wallet-amount-help" className="mt-1 text-[11px] text-muted-foreground">
              Between {formatPrice(MIN)} and {formatPrice(MAX)}. For larger amounts, contact us to
              pay by bank transfer.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {formatPrice(q)}
              </button>
            ))}
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-secondary/30 p-3">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 cursor-pointer rounded border-border text-primary focus:ring-primary"
              required
            />
            <span className="text-[11px] leading-relaxed text-muted-foreground">
              {isAssisted && (
                /*
                  An admin ticking this is accepting on the customer's behalf, which is a
                  different thing from the customer accepting it themselves. The record marks
                  it as second-hand, and the wording makes sure the admin knows what they are
                  attesting to rather than clicking past it.
                */
                <span className="mb-1.5 block font-semibold text-foreground">
                  I have read these terms to {onBehalfOf!.customerName} and they agree:
                </span>
              )}
              {WALLET_TERMS_TEXT}
            </span>
          </label>

          {needsKycAck && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-300/60 bg-amber-50/50 p-3 dark:border-amber-800/60 dark:bg-amber-950/20">
              <input
                type="checkbox"
                checked={kycAcknowledged}
                onChange={(e) => setKycAcknowledged(e.target.checked)}
                className="mt-0.5 cursor-pointer rounded border-border text-primary focus:ring-primary"
                required
              />
              <span className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                {isAssisted
                  ? `${onBehalfOf!.customerName} understands this balance cannot be used until their KYC is approved.`
                  : "I understand this balance cannot be used until my KYC is approved."}
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="gap-1.5 font-semibold">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isSubmitting
                ? "Opening payment…"
                : isAssisted
                  ? `Collect ${amountValid ? formatPrice(numericAmount) : "payment"}`
                  : `Add ${amountValid ? formatPrice(numericAmount) : "money"}`}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
