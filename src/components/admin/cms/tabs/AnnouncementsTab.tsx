"use client";

import * as React from "react";
import { Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface AnnouncementsTabProps {
  announcements: string[];
  onEdit: (idx: number, item: { text: string }) => void;
  onDelete: (idx: number) => void;
}

export function AnnouncementsTab({ announcements, onEdit, onDelete }: AnnouncementsTabProps) {
  return (
    <div className="space-y-3">
      {announcements.map((msg, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 border rounded-xl bg-card gap-4 text-foreground">
          <p className="font-medium text-xs text-foreground flex-1">#{idx + 1} — {msg}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, { text: msg })} aria-label="Edit Announcement">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(idx)} aria-label="Delete Announcement">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
