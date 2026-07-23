"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useProductForm } from "./ProductFormContext";
import { Percent } from "lucide-react";

export function TaxComplianceCard() {
  const {
    hsnCode,
    setHsnCode,
    hsns,
    priceIncludesGst,
    setPriceIncludesGst,
    defaultPriceTier,
    setDefaultPriceTier
  } = useProductForm();

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <h3 className="font-bold text-lg border-b pb-2">B2B Compliance & Taxation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* HSN Dropdown */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1">
              <Percent className="h-4 w-4 text-muted-foreground" /> HSN Code
            </label>
            <select
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-foreground font-semibold"
            >
              {hsns.map((h) => (
                <option key={h._id} value={h.code}>
                  HSN {h.code} ({h.gstRate}% GST)
                </option>
              ))}
            </select>
          </div>

          {/* GST Inclusive/Exclusive Toggle Button */}
          <div className="space-y-2">
            <label className="text-sm font-medium block">GST Surcharge Setting</label>
            <button
              type="button"
              onClick={() => setPriceIncludesGst(!priceIncludesGst)}
              className={`w-full h-10 px-4 rounded-md border text-sm font-bold transition-all cursor-pointer ${priceIncludesGst
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                }`}
            >
              {priceIncludesGst ? "Prices INCLUDE GST" : "Prices EXCLUDE GST"}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
