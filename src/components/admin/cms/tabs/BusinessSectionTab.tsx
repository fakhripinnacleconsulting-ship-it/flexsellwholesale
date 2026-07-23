"use client";

import * as React from "react";
import { Edit3, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BusinessSectionData, BusinessCardItem } from "../types";

interface BusinessSectionTabProps {
  data: BusinessSectionData;
  setData: React.Dispatch<React.SetStateAction<BusinessSectionData>>;
  sectionKey: string;
  isSaving: boolean;
  onSaveHeadings: (key: string, data: BusinessSectionData) => void;
  onEditCard: (idx: number, card: BusinessCardItem) => void;
  onDeleteCard: (idx: number) => void;
  titleColorClass?: string;
}

export function BusinessSectionTab({
  data,
  setData,
  sectionKey,
  isSaving,
  onSaveHeadings,
  onEditCard,
  onDeleteCard,
  titleColorClass = "text-primary"
}: BusinessSectionTabProps) {
  return (
    <div className="space-y-4 text-foreground">
      <div className="p-4 border rounded-xl space-y-2 bg-secondary/10">
        <p className={`text-xs font-bold uppercase ${titleColorClass}`}>Section Headings</p>
        <Input
          value={data.heading || ""}
          onChange={(e) => setData({ ...data, heading: e.target.value })}
          className="text-xs font-bold"
        />
        <Input
          value={data.subheading || ""}
          onChange={(e) => setData({ ...data, subheading: e.target.value })}
          className="text-xs"
        />
        <Button
          size="sm"
          onClick={() => onSaveHeadings(sectionKey, data)}
          disabled={isSaving}
          className="mt-2 text-xs font-bold"
        >
          <Save className="h-3.5 w-3.5 mr-1" /> Save Headings
        </Button>
      </div>

      {data.cards && data.cards.map((card, idx) => (
        <div key={idx} className="flex items-center justify-between p-4 border rounded-xl bg-card gap-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-primary border px-2 py-0.5 rounded bg-primary/10">
              {card.badge || "Feature"}
            </span>
            <h4 className="font-bold text-sm text-foreground">{card.title}</h4>
            <p className="text-xs text-muted-foreground">{card.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEditCard(idx, card)} aria-label="Edit Feature Card">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDeleteCard(idx)} aria-label="Delete Feature Card">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
