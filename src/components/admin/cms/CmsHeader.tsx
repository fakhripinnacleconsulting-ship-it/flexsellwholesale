"use client";

import * as React from "react";
import { Layers, Database } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CmsHeaderProps {
  onOpenSeedModal: () => void;
}

export function CmsHeader({ onOpenSeedModal }: CmsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Layers className="h-8 w-8 text-primary" /> Centralized Website CMS Manager
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage public storefront sections, image banners, business details, testimonials, FAQs, and corporate policies.
        </p>
      </div>

      {/* <Button
        type="button"
        onClick={onOpenSeedModal}
        variant="outline"
        className="font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-2 cursor-pointer shrink-0"
      >
        <Database className="h-4 w-4" /> Seed / Reset Database Defaults
      </Button> */}
    </div>
  );
}
