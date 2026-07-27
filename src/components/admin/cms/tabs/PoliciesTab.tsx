"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Save, ShieldCheck, FileText, Truck, RotateCcw, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[260px] bg-secondary/10 border border-input rounded-md flex items-center justify-center text-muted-foreground text-sm font-medium">
      Loading enterprise editor...
    </div>
  ),
});

interface PoliciesTabProps {
  policies: any;
  setPolicies: React.Dispatch<React.SetStateAction<any>>;
  isSaving: boolean;
  onSave: (key: string, data: any) => void;
}

const POLICY_METADATA = [
  { key: "privacy", label: "Privacy Policy", icon: ShieldCheck, desc: "Data protection, buyer privacy disclosures, and cookie policies." },
  { key: "terms", label: "Terms of Service", icon: FileText, desc: "B2B wholesale trading terms, ordering rules, and buyer compliance." },
  { key: "shipping", label: "Shipping & Logistics Policy", icon: Truck, desc: "Dispatch SLAs, Bhopal cargo terms, freight charges, and tracking terms." },
  { key: "return", label: "Return & Refund Policy", icon: RotateCcw, desc: "Damaged stock return windows, B2B wholesale exchange, and refund rules." },
];

export function PoliciesTab({ policies, setPolicies, isSaving, onSave }: PoliciesTabProps) {
  const [activePolicyKey, setActivePolicyKey] = React.useState<string>("privacy");

  const currentPolicy = policies?.[activePolicyKey] || {};
  const currentMeta = POLICY_METADATA.find(p => p.key === activePolicyKey) || POLICY_METADATA[0];
  const Icon = currentMeta.icon;

  const handleUpdateCurrentPolicy = (field: string, val: any) => {
    const updated = {
      ...policies,
      [activePolicyKey]: {
        ...currentPolicy,
        [field]: val,
      },
    };
    setPolicies(updated);
  };

  const handleSave = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const updated = {
      ...policies,
      [activePolicyKey]: {
        ...currentPolicy,
        lastUpdated: currentPolicy.lastUpdated || todayStr,
      },
    };
    setPolicies(updated);
    onSave("policies", updated);
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Sub Tab Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {POLICY_METADATA.map((pm) => {
          const PIcon = pm.icon;
          const isSelected = activePolicyKey === pm.key;
          return (
            <button
              key={pm.key}
              type="button"
              onClick={() => setActivePolicyKey(pm.key)}
              className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <PIcon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                {policies?.[pm.key]?.content && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500" title="Content Set" />
                )}
              </div>
              <div className="mt-2">
                <p className="font-bold text-xs text-foreground">{pm.label}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {policies?.[pm.key]?.lastUpdated ? `Updated: ${policies[pm.key].lastUpdated}` : "Not updated"}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Policy Editor Card */}
      <div className="border border-border rounded-2xl bg-card p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-foreground">{currentMeta.label}</h3>
              <p className="text-xs text-muted-foreground">{currentMeta.desc}</p>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="default"
            className="font-bold shadow-md self-start sm:self-center flex items-center gap-1.5"
          >
            <Save className="h-4 w-4" />
            <span>Save {currentMeta.label}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Document Title *</label>
            <Input
              value={currentPolicy.title || currentMeta.label}
              onChange={(e) => handleUpdateCurrentPolicy("title", e.target.value)}
              placeholder={`e.g. ${currentMeta.label}`}
              className="text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Last Updated Date</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 text-primary" /> YYYY-MM-DD
              </span>
            </label>
            <Input
              value={currentPolicy.lastUpdated || ""}
              onChange={(e) => handleUpdateCurrentPolicy("lastUpdated", e.target.value)}
              placeholder="e.g. 2026-07-27"
              className="text-xs font-mono font-bold"
            />
          </div>
        </div>

        {/* Policy Body Rich Text Editor */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-foreground block">
            Policy Body Content (Rich HTML & Formatting) *
          </label>
          <RichTextEditor
            value={currentPolicy.content || ""}
            onChange={(val) => handleUpdateCurrentPolicy("content", val)}
            placeholder={`Write full ${currentMeta.label} text with headings, terms, bullet lists, and tables...`}
            minHeight="320px"
          />
        </div>
      </div>
    </div>
  );
}
