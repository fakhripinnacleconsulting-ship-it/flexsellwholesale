"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DropshipPageContent } from "../types";

interface DropshipPageTabProps {
  data: DropshipPageContent;
  setData: React.Dispatch<React.SetStateAction<DropshipPageContent>>;
  isSaving: boolean;
  onSave: (key: string, data: DropshipPageContent) => void;
}

export function DropshipPageTab({ data, setData, isSaving, onSave }: DropshipPageTabProps) {
  return (
    <div className="space-y-4 text-foreground">
      <div className="p-4 border rounded-xl space-y-3 bg-secondary/10">
        <p className="text-xs font-bold uppercase text-purple-600">Hero Section Headings</p>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Badge Label</label>
          <Input
            value={data.badge || ""}
            onChange={(e) => setData({ ...data, badge: e.target.value })}
            className="text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Hero Heading</label>
          <Input
            value={data.heroHeading || ""}
            onChange={(e) => setData({ ...data, heroHeading: e.target.value })}
            className="text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Hero Subheading</label>
          <textarea
            rows={2}
            className="w-full p-2 text-xs border rounded bg-background"
            value={data.heroSubheading || ""}
            onChange={(e) => setData({ ...data, heroSubheading: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">CTA Button Text</label>
          <Input
            value={data.ctaText || ""}
            onChange={(e) => setData({ ...data, ctaText: e.target.value })}
            className="text-xs"
          />
        </div>
      </div>

      <div className="p-4 border rounded-xl space-y-3 bg-secondary/10">
        <p className="text-xs font-bold uppercase text-purple-600">Application Form Headings</p>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Form Badge Label</label>
          <Input
            value={data.formBadge || ""}
            onChange={(e) => setData({ ...data, formBadge: e.target.value })}
            className="text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Form Title</label>
          <Input
            value={data.formHeading || ""}
            onChange={(e) => setData({ ...data, formHeading: e.target.value })}
            className="text-xs font-bold"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase">Form Subtitle</label>
          <Input
            value={data.formSubheading || ""}
            onChange={(e) => setData({ ...data, formSubheading: e.target.value })}
            className="text-xs"
          />
        </div>
      </div>

      <Button
        onClick={() => onSave("dropshipping_page_content", data)}
        disabled={isSaving}
        className="font-bold text-xs"
      >
        <Save className="h-3.5 w-3.5 mr-1" /> Save Dropshipping Page Content
      </Button>
    </div>
  );
}
