"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface PoliciesTabProps {
  policies: any;
  setPolicies: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onSave: (key: string, data: any) => void;
}

export function PoliciesTab({ policies, setPolicies, isSaving, onSave }: PoliciesTabProps) {
  return (
    <div className="space-y-6 text-foreground">
      {["privacy", "terms", "shipping", "return"].map((polKey) => {
        const pol = policies?.[polKey] || {};
        return (
          <div key={polKey} className="p-4 border rounded-xl bg-card space-y-3">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm uppercase text-primary">{polKey} Policy</h3>
              <span className="text-xs text-muted-foreground">Updated: {pol.lastUpdated || "N/A"}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                value={pol.title || ""}
                onChange={(e) => setPolicies({ ...policies, [polKey]: { ...pol, title: e.target.value } })}
                className="text-xs font-bold"
              />
              <Input
                value={pol.lastUpdated || ""}
                onChange={(e) => setPolicies({ ...policies, [polKey]: { ...pol, lastUpdated: e.target.value } })}
                className="text-xs"
              />
            </div>
            <Button
              size="sm"
              onClick={() => onSave("policies", policies)}
              disabled={isSaving}
              className="text-xs font-bold"
            >
              <Save className="h-3.5 w-3.5 mr-1" /> Save {polKey.toUpperCase()} Policy
            </Button>
          </div>
        );
      })}
    </div>
  );
}
