"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface FooterTabProps {
  footer: any;
  setFooter: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onSave: (key: string, data: any) => void;
}

export function FooterTab({ footer, setFooter, isSaving, onSave }: FooterTabProps) {
  return (
    <div className="space-y-4 text-foreground">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground">Corporate Description</label>
          <textarea
            rows={3}
            className="w-full p-2.5 text-xs border rounded bg-background"
            value={footer.description || ""}
            onChange={(e) => setFooter({ ...footer, description: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground">Office & Warehouse Address</label>
          <textarea
            rows={3}
            className="w-full p-2.5 text-xs border rounded bg-background"
            value={footer.officeAddress || ""}
            onChange={(e) => setFooter({ ...footer, officeAddress: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground">Contact Email</label>
          <Input
            value={footer.contactEmail || ""}
            onChange={(e) => setFooter({ ...footer, contactEmail: e.target.value })}
            className="text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase text-muted-foreground">Contact Phone</label>
          <Input
            value={footer.contactPhone || ""}
            onChange={(e) => setFooter({ ...footer, contactPhone: e.target.value })}
            className="text-xs"
          />
        <div className="space-y-1 sm:col-span-2 border-t pt-3">
          <label className="text-xs font-bold uppercase text-muted-foreground">Payment Methods Banner Image URL (Single Image)</label>
          <Input
            placeholder="e.g. /images/payment-methods.svg or custom CDN image URL"
            value={footer.paymentImage || footer.paymentBannerUrl || ""}
            onChange={(e) => setFooter({ ...footer, paymentImage: e.target.value, paymentBannerUrl: e.target.value })}
            className="text-xs"
          />
          <p className="text-[11px] text-muted-foreground">URL of the single combined payment methods banner image. If empty, defaults to standard VISA, MasterCard, G Pay, UPI, & COD banner.</p>

          {(footer.paymentImage || footer.paymentBannerUrl || "/images/payment-methods.svg") && (
            <div className="mt-2 p-2 bg-white rounded-lg border border-slate-200 inline-block">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Live Image Preview:</p>
              <img
                src={footer.paymentImage || footer.paymentBannerUrl || "/images/payment-methods.svg"}
                alt="Payment Methods Banner Preview"
                className="h-10 w-auto max-w-[400px] object-contain"
              />
            </div>
          )}
        </div>
      </div>
      <Button onClick={() => onSave("footer", footer)} disabled={isSaving} className="font-bold text-xs">
        <Save className="h-3.5 w-3.5 mr-1" /> Save Footer Configuration
      </Button>
    </div>
  );
}
