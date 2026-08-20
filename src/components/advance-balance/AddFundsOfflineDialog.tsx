"use client";

import * as React from "react";
import { uploadWithCompression } from "@/lib/uploadHelper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { formatPrice } from "@/lib/utils";
import * as advanceBalanceService from "@/services/advanceBalanceService";
import { ADMIN_REAUTH_THRESHOLD_PAISE } from "@/lib/advanceBalanceConstants";
import { toRupees } from "@/lib/money";
import { X, Loader2, AlertTriangle, Wallet as AdvanceBalanceIcon, Briefcase } from "lucide-react";
import type { AdvanceBalanceType, OfflineCreditInput } from "@/types/advanceBalance";

interface AddFundsOfflineDialogProps {
  userId: string;
  customerName: string;
  businessEligible: boolean;
  onClose: () => void;
  onCredited: (message: string) => void;
}

type Source = OfflineCreditInput["source"];

const SOURCES: Array<{ value: Source; label: string; needsRef: boolean }> = [
  { value: "cash", label: "Cash", needsRef: false },
  { value: "bank_transfer", label: "Bank transfer", needsRef: true },
  { value: "upi", label: "UPI", needsRef: true },
  { value: "cheque", label: "Cheque", needsRef: true },
];

const REAUTH_THRESHOLD = toRupees(ADMIN_REAUTH_THRESHOLD_PAISE);

/**
 * Credits money received outside the payment gateway.
 *
 * This is the one screen in the product that creates spendable balance with nothing
 * external confirming it, so it asks for more than the others: proof of payment always, a
 * reference wherever one exists, and the admin's own password above a threshold. None of
 * that stops a determined admin — it makes what they did reconstructable afterwards.
 */
export function AddFundsOfflineDialog({
  userId,
  customerName,
  businessEligible,
  onClose,
  onCredited,
}: AddFundsOfflineDialogProps) {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((s) => s.confirm);

  const clientRequestId = React.useRef(advanceBalanceService.newRequestId());

  const [walletType, setWalletType] = React.useState<AdvanceBalanceType>(businessEligible ? "business" : "store");
  const [source, setSource] = React.useState<Source>("cash");
  const [amount, setAmount] = React.useState("");
  const [referenceId, setReferenceId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [proofUrl, setProofUrl] = React.useState("");
  const [adminPassword, setAdminPassword] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const triggerRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    return () => triggerRef.current?.focus?.();
  }, []);

  const numericAmount = Number(amount);
  const needsRef = SOURCES.find((s) => s.value === source)?.needsRef ?? false;
  const needsPassword = Number.isFinite(numericAmount) && numericAmount >= REAUTH_THRESHOLD;
  const isCheque = source === "cheque";

  const valid =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    (needsRef ? referenceId.trim().length > 0 : description.trim().length >= 3) &&
    (!needsPassword || adminPassword.length > 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      // A payment proof names a customer and an amount, so it is private: stored by
      // pathname and served behind an ownership check, never from a public CDN URL.
      const uploaded = await uploadWithCompression(file, { kind: "proof" });
      if (uploaded.url) setProofUrl(uploaded.url);
    } catch (err) {
      addToast((err as Error).message || "Could not upload the proof", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const result = await advanceBalanceService.creditOffline({
        userId,
        walletType,
        source,
        amount: numericAmount,
        referenceId: referenceId.trim() || undefined,
        description: description.trim() || undefined,
        proofUrl: proofUrl.trim() || undefined,
        clientRequestId: clientRequestId.current,
        adminPassword,
      });
      onCredited(result.message || `${formatPrice(numericAmount)} added.`);
    } catch (err) {
      addToast((err as Error).message || "Could not add the funds", "error");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isSubmitting) return;

    confirmAction({
      title: `Add ${formatPrice(numericAmount)} to ${customerName}?`,
      message: isCheque
        ? "Cheques are recorded as pending and do not become spendable until you confirm they have cleared."
        : "This creates spendable balance immediately. It cannot be undone without a reversal entry, and the customer will be notified.",
      confirmText: "Add funds",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: submit,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="funds-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="funds-title" className="text-base font-bold tracking-tight">Add funds offline</h2>
            <p className="text-[11px] text-muted-foreground">
              {customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-secondary disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {businessEligible && (
          <div className="mb-5 inline-flex w-full rounded-lg border border-border bg-secondary/30 p-1 backdrop-blur-sm">
            {(["business", "store"] as const).map((tab) => {
              const isSelected = walletType === tab;
              const Icon = tab === "store" ? AdvanceBalanceIcon : Briefcase;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setWalletType(tab)}
                  className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-xs font-bold transition-all duration-200 ease-out active:scale-95 ${
                    isSelected
                      ? "bg-card text-primary shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground/70"}`} aria-hidden="true" />
                  {tab === "store" ? "Store Advance Balance" : "Business Advance Balance"}
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            This creates real balance with no payment gateway behind it. Your name, IP and the
            proof you attach are recorded permanently against this entry.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="fund-source" className="mb-1 block text-xs font-semibold text-muted-foreground">
              How was it received? <span className="text-destructive">*</span>
            </label>
            <select
              id="fund-source"
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
              className="h-10 w-full cursor-pointer rounded-md border bg-background px-3 text-sm font-medium text-foreground"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            {isCheque && (
              <p className="mt-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                Recorded as pending — a bounced cheque must not leave spendable balance behind.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="fund-amount" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Amount <span className="text-destructive">*</span>
            </label>
            <Input
              id="fund-amount"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-sm font-bold tabular-nums"
            />
          </div>

          {needsRef ? (
            <div>
              <label htmlFor="fund-ref" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Reference number <span className="text-destructive">*</span>
              </label>
              <Input
                id="fund-ref"
                required
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="UTR / cheque number"
                className="text-sm font-mono"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                So this can be matched against a bank statement later.
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="fund-note" className="mb-1 block text-xs font-semibold text-muted-foreground">
                How was this cash received? <span className="text-destructive">*</span>
              </label>
              <textarea
                id="fund-note"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="e.g. Received at the Surat office from Mr Sharma, receipt RCP-1042"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Cash has no reference number, so this note is the only reviewable record.
              </p>
            </div>
          )}

          <div className="rounded-lg border bg-secondary/20 p-3">
            <label htmlFor="fund-proof" className="block text-xs font-bold text-foreground">
              Proof of payment <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <p className="mb-2 mt-0.5 text-[10px] text-muted-foreground">
              Receipt, deposit slip or screenshot (optional).
            </p>
            <input
              id="fund-proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              disabled={isUploading}
              className="block w-full cursor-pointer text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground"
            />
            {isUploading && <p className="mt-1.5 animate-pulse text-[10px] text-primary">Uploading…</p>}
            {proofUrl && !isUploading && (
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Proof attached</p>
                <button
                  type="button"
                  onClick={() => setProofUrl("")}
                  className="text-[10px] text-destructive hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {needsPassword && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label htmlFor="fund-pass" className="mb-1 block text-xs font-bold text-foreground">
                Confirm your password <span className="text-destructive">*</span>
              </label>
              <Input
                id="fund-pass"
                type="password"
                required
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="text-sm"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Required for amounts of {formatPrice(REAUTH_THRESHOLD)} or more.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || isSubmitting} className="gap-1.5 font-semibold">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add funds
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
