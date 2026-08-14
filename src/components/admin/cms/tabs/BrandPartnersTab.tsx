"use client";

import * as React from "react";
import { Edit3, Trash2, Globe, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandPartner } from "../types";

interface BrandPartnersTabProps {
  brandPartners: BrandPartner[];
  isVisible: boolean;
  onToggleVisibility: (visible: boolean) => void;
  onEdit: (idx: number, partner: BrandPartner) => void;
  onDelete: (idx: number) => void;
}

export function BrandPartnersTab({ brandPartners, isVisible, onToggleVisibility, onEdit, onDelete }: BrandPartnersTabProps) {
  return (
    <div className="space-y-4 text-foreground">
      {/* Visibility Toggle Section */}
      <div className="flex items-center justify-between p-4 bg-secondary/20 border rounded-xl">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isVisible ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="font-bold text-sm">Storefront Visibility</h4>
            <p className="text-xs text-muted-foreground">Toggle whether the Trusted Factory & Sourcing Partners section is displayed on the live website.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold mr-2">{isVisible ? "Visible" : "Hidden"}</label>
          <input
            type="checkbox"
            checked={isVisible ?? true}
            onChange={(e) => onToggleVisibility(e.target.checked)}
            className="h-5 w-5 cursor-pointer accent-primary"
            title="Toggle Visibility"
          />
        </div>
      </div>

      <div className="space-y-3">
        {brandPartners.map((partner, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-card gap-4">
            <div className="flex items-center gap-4">
              {partner.logoUrl && <img src={partner.logoUrl} alt={partner.name} className="h-8 w-24 object-contain" />}
              <div className="flex flex-col">
                <span className="font-bold text-sm text-foreground">{partner.name}</span>
                {partner.websiteUrl && (
                  <a href={partner.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline mt-0.5">
                    <Globe className="h-3 w-3" /> {partner.websiteUrl}
                  </a>
                )}
              </div>
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
    </div>
  );
}
