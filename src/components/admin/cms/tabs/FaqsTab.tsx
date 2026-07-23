"use client";

import * as React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FaqItem } from "../types";

interface FaqsTabProps {
  faqs: FaqItem[];
  onEdit: (idx: number, faq: FaqItem) => void;
  onDelete: (idx: number) => void;
}

export function FaqsTab({ faqs, onEdit, onDelete }: FaqsTabProps) {
  return (
    <div className="space-y-3 text-foreground">
      {faqs.map((faq, idx) => (
        <div key={idx} className="flex items-center justify-between p-4 border rounded-xl bg-card gap-4">
          <div className="space-y-1 flex-1">
            <span className="text-[10px] font-bold uppercase text-primary border px-2 py-0.5 rounded bg-primary/10">
              {faq.category || "General"}
            </span>
            <h4 className="font-bold text-sm text-foreground">{faq.question}</h4>
            <p className="text-xs text-muted-foreground line-clamp-2">{faq.answer}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, faq)} aria-label="Edit FAQ">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(idx)} aria-label="Delete FAQ">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
