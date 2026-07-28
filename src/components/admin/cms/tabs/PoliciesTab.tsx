"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Save, ShieldCheck, FileText, Truck, RotateCcw, Clock, CheckCircle2 } from "lucide-react";
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

interface PolicyData {
  title: string;
  lastUpdated: string;
  content: string;
}

const POLICY_METADATA = [
  { key: "privacy", label: "Privacy Policy", icon: ShieldCheck, desc: "Data protection, buyer privacy disclosures, and cookie policies." },
  { key: "terms", label: "Terms of Service", icon: FileText, desc: "B2B wholesale trading terms, ordering rules, and buyer compliance." },
  { key: "shipping", label: "Shipping & Logistics Policy", icon: Truck, desc: "Dispatch SLAs, Bhopal delivery terms, freight charges, and tracking terms." },
  { key: "return", label: "Return & Refund Policy", icon: RotateCcw, desc: "Damaged stock return windows, B2B wholesale exchange, and refund rules." },
];

const DEFAULT_POLICIES: Record<string, PolicyData> = {
  privacy: {
    title: "Privacy Policy & Data Security",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Buyer Data Privacy</h3><p>We strictly store and protect your business details including GST numbers, delivery addresses, and purchasing logs according to IT Act rules.</p><h3>2. Data Encryption</h3><p>All sensitive transactions are encrypted via SSL to ensure enterprise-grade security for bulk buyers.</p>`,
  },
  terms: {
    title: "B2B Wholesale Terms of Service",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Business Registration</h3><p>FlexSell is an exclusive B2B wholesale platform. Buyers must present valid business credentials or GST numbers for tax invoice generation.</p><h3>2. Minimum Order Quantities (MOQ)</h3><p>All wholesale orders must meet specified SKU quantity thresholds to qualify for tiered tier pricing.</p>`,
  },
  shipping: {
    title: "Freight & Shipping Policies",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Dispatch Timelines</h3><p>Bulk wholesale orders are packed and dispatched from our Bhopal warehouse within 24-48 working hours. Heavy freight shipping times range from 3-7 days.</p><h3>2. Remote Region Logistics Surcharges</h3><p>Special transport charges may apply for heavy freight going to Northeast states, J&K, and deep rural regions. Surcharges will be quoted by phone if needed.</p>`,
  },
  return: {
    title: "Bulk Return & Refund Policies",
    lastUpdated: "2026-07-27",
    content: `<h3>1. Zero Unsold Returns</h3><p>Because we run at minimal margins, we do not accept returns for unsold goods or change-of-mind situations. All wholesale sales are final.</p><h3>2. Transit Defect Claims</h3><p>A continuous, uncut video showing the opening of the parcel package is mandatory to process shipping transit damage claims. Approved claims receive wallet top-up credits.</p>`,
  },
};

export function PoliciesTab({ policies, setPolicies, isSaving, onSave }: PoliciesTabProps) {
  const [activePolicyKey, setActivePolicyKey] = React.useState<string>("privacy");

  // Sync initial policies state with defaults if any policy key is missing
  React.useEffect(() => {
    setPolicies((prev: any) => {
      const merged = {
        privacy: { ...DEFAULT_POLICIES.privacy, ...(prev?.privacy || {}) },
        terms: { ...DEFAULT_POLICIES.terms, ...(prev?.terms || {}) },
        shipping: { ...DEFAULT_POLICIES.shipping, ...(prev?.shipping || {}) },
        return: { ...DEFAULT_POLICIES.return, ...(prev?.return || {}) },
      };
      return merged;
    });
  }, [setPolicies]);

  const currentPolicy = policies?.[activePolicyKey] || DEFAULT_POLICIES[activePolicyKey as keyof typeof DEFAULT_POLICIES] || {};
  const currentMeta = POLICY_METADATA.find(p => p.key === activePolicyKey) || POLICY_METADATA[0];
  const Icon = currentMeta.icon;

  const handleUpdateCurrentPolicy = (field: string, val: any) => {
    setPolicies((prev: any) => {
      const current = prev?.[activePolicyKey] || DEFAULT_POLICIES[activePolicyKey as keyof typeof DEFAULT_POLICIES] || {};
      return {
        privacy: { ...DEFAULT_POLICIES.privacy, ...(prev?.privacy || {}) },
        terms: { ...DEFAULT_POLICIES.terms, ...(prev?.terms || {}) },
        shipping: { ...DEFAULT_POLICIES.shipping, ...(prev?.shipping || {}) },
        return: { ...DEFAULT_POLICIES.return, ...(prev?.return || {}) },
        [activePolicyKey]: {
          ...current,
          [field]: val,
        },
      };
    });
  };

  const handleSaveCurrentPolicy = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const current = policies?.[activePolicyKey] || DEFAULT_POLICIES[activePolicyKey as keyof typeof DEFAULT_POLICIES] || {};
    const updatedPolicies = {
      privacy: { ...DEFAULT_POLICIES.privacy, ...(policies?.privacy || {}) },
      terms: { ...DEFAULT_POLICIES.terms, ...(policies?.terms || {}) },
      shipping: { ...DEFAULT_POLICIES.shipping, ...(policies?.shipping || {}) },
      return: { ...DEFAULT_POLICIES.return, ...(policies?.return || {}) },
      [activePolicyKey]: {
        ...current,
        title: current.title || currentMeta.label,
        lastUpdated: current.lastUpdated || todayStr,
      },
    };
    setPolicies(updatedPolicies);
    onSave("policies", updatedPolicies);
  };

  const handleSaveAllPolicies = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const updatedPolicies = {
      privacy: { ...DEFAULT_POLICIES.privacy, ...(policies?.privacy || {}), lastUpdated: policies?.privacy?.lastUpdated || todayStr },
      terms: { ...DEFAULT_POLICIES.terms, ...(policies?.terms || {}), lastUpdated: policies?.terms?.lastUpdated || todayStr },
      shipping: { ...DEFAULT_POLICIES.shipping, ...(policies?.shipping || {}), lastUpdated: policies?.shipping?.lastUpdated || todayStr },
      return: { ...DEFAULT_POLICIES.return, ...(policies?.return || {}), lastUpdated: policies?.return?.lastUpdated || todayStr },
    };
    setPolicies(updatedPolicies);
    onSave("policies", updatedPolicies);
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border p-4 rounded-2xl shadow-sm">
        <div>
          <h3 className="font-extrabold text-base">Legal Policies & Compliance Center</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage Privacy, Terms of Service, Shipping, and Returns policies with rich formatting and auto-updating timestamps.
          </p>
        </div>

        <Button
          onClick={handleSaveAllPolicies}
          disabled={isSaving}
          size="default"
          className="font-bold shadow-md self-start sm:self-center flex items-center gap-1.5 shrink-0 bg-primary text-primary-foreground cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>Save All 4 Policies</span>
        </Button>
      </div>

      {/* Sub Tab Navigation Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {POLICY_METADATA.map((pm) => {
          const PIcon = pm.icon;
          const isSelected = activePolicyKey === pm.key;
          const polData = policies?.[pm.key] || DEFAULT_POLICIES[pm.key as keyof typeof DEFAULT_POLICIES];
          const hasContent = !!polData?.content?.trim();

          return (
            <button
              key={pm.key}
              type="button"
              onClick={() => setActivePolicyKey(pm.key)}
              className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <PIcon className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                {hasContent && (
                  <span title="Policy content active">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  </span>
                )}
              </div>
              <div className="mt-2.5">
                <p className="font-bold text-xs text-foreground">{pm.label}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5 font-medium">
                  {polData?.lastUpdated ? `Updated: ${polData.lastUpdated}` : "Default Active"}
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
            onClick={handleSaveCurrentPolicy}
            disabled={isSaving}
            size="default"
            variant="outline"
            className="font-bold border-primary/30 text-primary hover:bg-primary/10 self-start sm:self-center flex items-center gap-1.5 cursor-pointer"
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
              <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
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

        {/* Policy Body Rich Text Editor with key={activePolicyKey} to force remount on tab change */}
        <div className="space-y-2 pt-2">
          <label className="text-xs font-bold text-foreground block">
            Policy Body Content (Rich HTML & Formatting) *
          </label>
          <RichTextEditor
            key={activePolicyKey}
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
