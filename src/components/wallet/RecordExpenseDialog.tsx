"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { formatPrice } from "@/lib/utils";
import * as walletService from "@/services/walletService";
import { X, Loader2, ShieldAlert, Wallet, Briefcase } from "lucide-react";
import type { WalletType, WalletExpenseCategory } from "@/types/wallet";

interface RecordExpenseDialogProps {
  userId: string;
  customerName: string;
  businessEligible: boolean;
  kycApproved: boolean;
  onClose: () => void;
  onRecorded: (message: string) => void;
}

/**
 * Records an expense against a customer's wallet.
 *
 * The idempotency key is generated **when this dialog opens**, not when it submits, and is
 * reused for every retry of this one intent. That is what makes a double-click or a retried
 * request land as one debit — which matters more here than in most forms, because the
 * ledger is append-only and a duplicate can only be undone by an admin reversal that the
 * customer will also see.
 */
export function RecordExpenseDialog({
  userId,
  customerName,
  businessEligible,
  kycApproved,
  onClose,
  onRecorded,
}: RecordExpenseDialogProps) {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((s) => s.confirm);

  // Generated once, on mount. Regenerating at submit time would defeat the entire purpose.
  const clientRequestId = React.useRef(walletService.newRequestId());

  const [walletType, setWalletType] = React.useState<WalletType>(businessEligible ? "business" : "store");
  const [categories, setCategories] = React.useState<WalletExpenseCategory[]>([]);
  const [category, setCategory] = React.useState("");
  const [name, setName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [referenceId, setReferenceId] = React.useState("");
  const [proofUrl, setProofUrl] = React.useState("");
  const [isUploading, setIsUploading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const triggerRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    return () => triggerRef.current?.focus?.();
  }, []);

  React.useEffect(() => {
    walletService
      .getExpenseCategories()
      .then(setCategories)
      .catch(() => addToast("Could not load expense categories", "error"));
  }, [addToast]);

  const blockedByKyc = walletType === "business" && !kycApproved;
  const numericAmount = Number(amount);
  const valid =
    category &&
    name.trim().length >= 2 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    !blockedByKyc;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers: Record<string, string> = {};
      const csrf = document.cookie.match(/csrf_token=([^;]+)/);
      if (csrf?.[1]) headers["X-CSRF-Token"] = csrf[1];

      const res = await fetch("/api/customers/upload-document", { method: "POST", headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      if (data.url) setProofUrl(data.url);
    } catch (err) {
      addToast((err as Error).message || "Could not upload the bill", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const result = await walletService.recordExpense({
        userId,
        walletType,
        expenseCategory: category,
        transactionName: name.trim(),
        amount: numericAmount,
        description: description.trim() || undefined,
        referenceId: referenceId.trim() || undefined,
        proofUrl: proofUrl || undefined,
        clientRequestId: clientRequestId.current,
      });

      onRecorded(
        result.duplicate
          ? "This expense was already recorded — no second charge was made."
          : `${formatPrice(numericAmount)} recorded against ${customerName}.`
      );
    } catch (err) {
      addToast((err as Error).message || "Could not record the expense", "error");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || isSubmitting) return;

    const categoryLabel = categories.find((c) => c.key === category)?.label || category;

    confirmAction({
      title: `Charge ${formatPrice(numericAmount)} to ${customerName}?`,
      // Names the amount and the customer. "Are you sure?" prevents nothing; the wrong
      // customer is the likelier mistake, and this is what catches it.
      message: `${categoryLabel} — ${name.trim()}. This is deducted from their ${
        walletType === "business" ? "Business" : "Store"
      } Wallet immediately and they will be notified. It can only be undone by an admin reversal.`,
      confirmText: "Record expense",
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
        aria-labelledby="expense-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="expense-title" className="text-base font-bold tracking-tight">Record an expense</h2>
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
              const Icon = tab === "store" ? Wallet : Briefcase;
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
                  {tab === "store" ? "Store Wallet" : "Business Wallet"}
                </button>
              );
            })}
          </div>
        )}

        {blockedByKyc && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-800/60 dark:bg-amber-950/30">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
              This customer&apos;s KYC is not approved, so services cannot be charged to the Business
              Wallet yet.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label htmlFor="exp-category" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Category <span className="text-destructive">*</span>
            </label>
            <select
              id="exp-category"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 w-full cursor-pointer rounded-md border bg-background px-3 text-sm font-medium text-foreground"
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="exp-name" className="mb-1 block text-xs font-semibold text-muted-foreground">
              What was this for? <span className="text-destructive">*</span>
            </label>
            <Input
              id="exp-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Facebook Ads — August campaign"
              className="text-sm"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">
              The customer sees this on their passbook, so write it for them.
            </p>
          </div>

          <div>
            <label htmlFor="exp-amount" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Amount <span className="text-destructive">*</span>
            </label>
            <Input
              id="exp-amount"
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

          <div>
            <label htmlFor="exp-ref" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Reference
            </label>
            <Input
              id="exp-ref"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Ad account, ARN, challan number"
              className="text-sm font-mono"
            />
          </div>

          <div>
            <label htmlFor="exp-notes" className="mb-1 block text-xs font-semibold text-muted-foreground">
              Notes
            </label>
            <textarea
              id="exp-notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="rounded-lg border bg-secondary/20 p-3">
            <label htmlFor="exp-bill" className="block text-xs font-bold text-foreground">
              Bill or invoice
            </label>
            <p className="mb-2 mt-0.5 text-[10px] text-muted-foreground">
              Required for managers. This is what shows the expense was real.
            </p>
            <input
              id="exp-bill"
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              disabled={isUploading}
              className="block w-full cursor-pointer text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground"
            />
            {isUploading && <p className="mt-1.5 animate-pulse text-[10px] text-primary">Uploading…</p>}
            {proofUrl && !isUploading && (
              <p className="mt-1.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                ✓ Bill attached
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || isSubmitting} className="gap-1.5 font-semibold">
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Record expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
