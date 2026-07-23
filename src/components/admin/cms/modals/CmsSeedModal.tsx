"use client";

import * as React from "react";
import { Database } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CmsSeedModalProps {
  isOpen: boolean;
  isSeeding: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function CmsSeedModal({ isOpen, isSeeding, onClose, onConfirm }: CmsSeedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-center text-foreground">
        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full w-max mx-auto">
          <Database className="h-8 w-8" />
        </div>
        <h3 className="font-bold text-xl">Seed Database Defaults</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This action will populate MongoDB with initial production-grade Categories, Products, Hero Banners, FAQs, Corporate Policies, and CMS settings. Existing items with matching keys will be updated.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSeeding}>Cancel</Button>
          <Button type="button" onClick={onConfirm} disabled={isSeeding} className="font-bold bg-amber-600 hover:bg-amber-700 text-white">
            {isSeeding ? "Seeding Database..." : "Confirm & Run Seed"}
          </Button>
        </div>
      </div>
    </div>
  );
}
