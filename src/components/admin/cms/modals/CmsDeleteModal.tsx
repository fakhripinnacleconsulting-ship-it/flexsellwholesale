"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CmsDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CmsDeleteModal({ isOpen, onClose, onConfirm }: CmsDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-destructive/30 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center text-foreground">
        <div className="p-3 bg-destructive/10 text-destructive rounded-full w-max mx-auto">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h3 className="font-bold text-lg">Confirm Item Deletion</h3>
        <p className="text-xs text-muted-foreground">Are you sure you want to delete this CMS item? This action will update the live storefront config.</p>
        <div className="flex justify-center gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={onConfirm} className="font-bold">Delete Item</Button>
        </div>
      </div>
    </div>
  );
}
