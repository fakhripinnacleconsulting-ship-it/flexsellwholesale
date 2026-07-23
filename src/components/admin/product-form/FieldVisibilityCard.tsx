"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { useProductForm } from "./ProductFormContext";

export function FieldVisibilityCard() {
  const { fieldVisibility, setFieldVisibility } = useProductForm();

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <h3 className="font-bold text-lg border-b pb-2">Storefront Field Visibility</h3>
        <p className="text-xs text-muted-foreground">
          Select which fields should be visible to buyers on the public Product Detail Page (PDP).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
          {Object.entries(fieldVisibility).map(([key, isChecked]) => {
            const label = key.replace("show", "").replace(/^\w/, (c) => c.toUpperCase());
            const isWeights = key === "showWeights";
            return (
              <label key={key} className={`flex items-center gap-2 text-sm font-semibold cursor-pointer ${isWeights ? "opacity-60 cursor-not-allowed" : ""}`}>
                <input
                  type="checkbox"
                  className="rounded text-primary focus:ring-primary bg-background border-border"
                  checked={isWeights ? true : isChecked}
                  disabled={isWeights}
                  onChange={(e) =>
                    !isWeights && setFieldVisibility((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                />
                <span>Show {label} {isWeights && " (Required)"}</span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
