"use client";

import * as React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TrustStatItem } from "../types";

interface TrustStatsTabProps {
  trustStats: TrustStatItem[];
  onEdit: (idx: number, stat: TrustStatItem) => void;
  onDelete: (idx: number) => void;
}

export function TrustStatsTab({ trustStats, onEdit, onDelete }: TrustStatsTabProps) {
  return (
    <div className="space-y-3">
      {trustStats.map((stat, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-card gap-4 text-foreground">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-primary/10 text-primary font-bold text-xs rounded">{stat.icon}</span>
            <div>
              <p className="font-bold text-sm text-foreground">{stat.count}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, stat)} aria-label="Edit Trust Stat">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(idx)} aria-label="Delete Trust Stat">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
