"use client";

import * as React from "react";
import { Star, Eye, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TestimonialItem } from "../types";

interface TestimonialsTabProps {
  testimonials: TestimonialItem[];
  onView: (item: TestimonialItem) => void;
  onEdit: (idx: number, item: TestimonialItem) => void;
  onDelete: (idx: number) => void;
}

export function TestimonialsTab({ testimonials, onView, onEdit, onDelete }: TestimonialsTabProps) {
  return (
    <div className="space-y-3 text-foreground">
      {testimonials.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between p-4 border rounded-xl bg-card gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
              <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-500" /> {item.rating}/5
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-secondary">{item.contentType}</span>
            </div>
            <p className="text-xs text-muted-foreground">{item.business} • {item.location}</p>
            <p className="text-xs text-foreground italic line-clamp-1">"{item.text}"</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => onView(item)} aria-label="View Review">
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, item)} aria-label="Edit Review">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(idx)} aria-label="Delete Review">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
