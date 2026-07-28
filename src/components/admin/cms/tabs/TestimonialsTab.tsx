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
      {testimonials.map((item, idx) => {
        const ratingVal = item.rating || 5;
        const avatar = item.avatarUpload || item.avatarUrl;

        return (
          <div key={idx} className="flex items-center justify-between p-4 border rounded-xl bg-card gap-4 hover:border-primary/40 transition-all">
            <div className="flex items-center gap-3.5 flex-1 min-w-0">
              {/* Reviewer Avatar / Image Thumbnail */}
              <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden text-primary font-bold text-xs">
                {avatar ? (
                  <img src={avatar} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{item.name ? item.name.charAt(0).toUpperCase() : "U"}</span>
                )}
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
                  
                  {/* Star Rating Display */}
                  <div className="flex items-center gap-0.5 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${i < ratingVal ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
                    ))}
                    <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 ml-1">
                      {ratingVal}.0
                    </span>
                  </div>

                  {/* Format Tag */}
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-secondary font-bold text-muted-foreground">
                    {item.contentType || "text"}
                  </span>

                  {/* Active Status Badge */}
                  {item.isActive === false ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                      Hidden
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground truncate">
                  {item.business && <span className="font-semibold text-foreground">{item.business}</span>}
                  {item.business && item.location && " • "}
                  {item.location}
                  {item.roleBadge && ` (${item.roleBadge})`}
                </p>

                <p className="text-xs text-foreground italic line-clamp-1">"{item.text}"</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => onView(item)} aria-label="View Review">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(idx, item)} aria-label="Edit Review">
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(idx)} aria-label="Delete Review">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
