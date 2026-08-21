import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

interface FreezeAdvanceBalanceDialogProps {
  walletType: "store" | "business";
  isFreezing: boolean;
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function FreezeAdvanceBalanceDialog({ walletType, isFreezing, open, onClose, onConfirm }: FreezeAdvanceBalanceDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (isFreezing && reason.trim().length < 5) {
      setError("Please provide a meaningful reason (at least 5 characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(isFreezing ? reason : "Reactivated by admin");
      setReason("");
    } catch (err: any) {
      setError(err.message || `Failed to ${isFreezing ? "freeze" : "reactivate"} Advance Balance`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFreezing ? `Freeze ${walletType} Advance Balance?` : `Reactivate ${walletType} Advance Balance?`}</DialogTitle>
          <DialogDescription>
            {isFreezing 
              ? "No money will be able to move in or out. The customer keeps their balance and can still read their statement, and they will be told why."
              : "Money will be able to move in and out again."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {isFreezing && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Why is this Advance Balance being frozen?</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                placeholder="The customer sees this reason..."
                rows={3}
                required
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant={isFreezing ? "destructive" : "default"} disabled={isSubmitting || (isFreezing && reason.trim().length < 5)}>
              {isSubmitting ? "Processing..." : (isFreezing ? "Freeze Advance Balance" : "Reactivate")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
