import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

interface TransferFundsDialogProps {
  customerName: string;
  availableBalance: number;
  open: boolean;
  onClose: () => void;
  onConfirm: (amount: number, password?: string) => Promise<void>;
}

export function TransferFundsDialog({ customerName, availableBalance, open, onClose, onConfirm }: TransferFundsDialogProps) {
  const [amountStr, setAmountStr] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const amount = Number(amountStr);
  const needsPassword = amount >= 50000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }
    
    if (amount > availableBalance) {
      setError(`Cannot transfer more than available balance (${formatPrice(availableBalance)})`);
      return;
    }

    if (needsPassword && !password) {
      setError("Password is required for transfers of ₹50,000 or more");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(amount, needsPassword ? password : undefined);
      setAmountStr("");
      setPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to transfer funds");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move funds to Business Advance Balance</DialogTitle>
          <DialogDescription>
            Moving funds for {customerName}. This cannot be reversed. Business Advance Balance balance can only be spent on services and can never move back to the Store Advance Balance or be withdrawn.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amount to transfer</label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">₹</span>
              <input
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                max={availableBalance}
                min={1}
                className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="0.00"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">Available: {formatPrice(availableBalance)}</p>
          </div>
          
          {needsPassword && (
            <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-900/50">
              <label className="text-sm font-medium text-amber-900 dark:text-amber-400">Admin Password Required</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-amber-300 dark:border-amber-800 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
                placeholder="Confirm your password"
                required
              />
              <p className="text-xs text-amber-700 dark:text-amber-500">Required for transfers of ₹50,000 or more.</p>
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || amount <= 0 || (needsPassword && !password)}>
              {isSubmitting ? "Moving..." : "Move Funds"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
