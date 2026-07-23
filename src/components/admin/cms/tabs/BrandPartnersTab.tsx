"use client";

import * as React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandPartner } from "../types";

interface BrandPartnersTabProps {
  brandPartners: BrandPartner[];
  onEdit: (idx: number, partner: BrandPartner) => void;
  onDelete: (idx: number) => void;
}

export function BrandPartnersTab({ brandPartners, onEdit, onDelete }: BrandPartnersTabProps) {
  return (
    <div className="space-y-3 text-foreground">
      {brandPartners.map((partner, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-card gap-4">
          <div className="flex items-center gap-4">
            {partner.logoUrl && <img src={partner.logoUrl} alt={partner.name} className="h-8 w-24 object-contain" />}
            <span className="font-bold text-sm text-foreground">{partner.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, partner)} aria-label="Edit Brand Partner">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(idx)} aria-label="Delete Brand Partner">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
