"use client";

import * as React from "react";
import { Save, MapPin, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { LocationSectionData } from "../types";

interface LocationSectionTabProps {
  data: LocationSectionData;
  setData: React.Dispatch<React.SetStateAction<LocationSectionData>>;
  isSaving: boolean;
  onSave: (key: string, value: any) => Promise<void>;
}

/**
 * Edits the location + map block that sits above the footer.
 *
 * Every field is optional: anything left blank falls back to the company details in
 * Business Settings, so the section is useful before anyone touches this tab.
 */
export function LocationSectionTab({ data, setData, isSaving, onSave }: LocationSectionTabProps) {
  const set = (patch: Partial<LocationSectionData>) => setData((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave("location_section", data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Location & Map Section
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown near the bottom of the homepage. Enable it from the Page Layout tab.
          </p>
        </div>
        <Button type="submit" disabled={isSaving} className="font-bold text-xs gap-1.5 cursor-pointer shrink-0">
          <Save className="h-4 w-4" /> Save Location
        </Button>
      </div>

      <div className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs font-medium">
          Leave a field blank to use the value from Business Settings. The map is not loaded until a
          visitor clicks &ldquo;View interactive map&rdquo; — this keeps the homepage fast.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          id="loc-heading"
          label="Heading"
          placeholder="Visit Our Warehouse"
          value={data.heading}
          onChange={(v) => set({ heading: v })}
        />
        <Field
          id="loc-subheading"
          label="Subheading"
          placeholder="Come see the stock in person..."
          value={data.subheading}
          onChange={(v) => set({ subheading: v })}
        />

        <div className="md:col-span-2">
          <label htmlFor="loc-address" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Full Address
          </label>
          <textarea
            id="loc-address"
            value={data.address || ""}
            onChange={(e) => set({ address: e.target.value })}
            placeholder="Falls back to the company address in Business Settings"
            rows={2}
            className="mt-1.5 w-full text-xs rounded-lg border border-border bg-background px-3 py-2 resize-y"
          />
        </div>

        <Field id="loc-phone" label="Phone" placeholder="+91 88877 66655" value={data.phone} onChange={(v) => set({ phone: v })} />
        <Field id="loc-email" label="Email" placeholder="support@flexsellwholesale.com" value={data.email} onChange={(v) => set({ email: v })} />
        <Field id="loc-timings" label="Opening Hours" placeholder="9:30 AM to 6:30 PM (Sunday Closed)" value={data.timings} onChange={(v) => set({ timings: v })} />
        <Field
          id="loc-directions"
          label="Directions URL"
          placeholder="Auto-generated from the address if left blank"
          value={data.directionsUrl}
          onChange={(v) => set({ directionsUrl: v })}
        />

        <div className="md:col-span-2">
          <label htmlFor="loc-embed" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Google Maps Embed URL
          </label>
          <Input
            id="loc-embed"
            value={data.mapEmbedUrl || ""}
            onChange={(e) => set({ mapEmbedUrl: e.target.value })}
            placeholder="https://www.google.com/maps/embed?pb=..."
            className="text-xs mt-1.5"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            In Google Maps: Share → Embed a map → copy the <code>src</code> value from the iframe.
            Leave blank to show address details without a map.
          </p>
        </div>

        <Field
          id="loc-static"
          label="Static Map Image URL (optional)"
          placeholder="Shown before the visitor loads the live map"
          value={data.staticMapImageUrl}
          onChange={(v) => set({ staticMapImageUrl: v })}
          className="md:col-span-2"
        />
      </div>

      <div className="flex justify-end pt-3 border-t">
        <Button type="submit" disabled={isSaving} className="font-bold text-xs gap-1.5 cursor-pointer px-6">
          <Save className="h-4 w-4" /> Save Location
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  className = "",
}: {
  id: string;
  label: string;
  placeholder: string;
  value?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <Input
        id={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xs mt-1.5"
      />
    </div>
  );
}
