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
        </div>
      </div>
      <Button onClick={() => onSave("footer", footer)} disabled={isSaving} className="font-bold text-xs">
        <Save className="h-3.5 w-3.5 mr-1" /> Save Footer Configuration
      </Button>
    </div>
  );
}
