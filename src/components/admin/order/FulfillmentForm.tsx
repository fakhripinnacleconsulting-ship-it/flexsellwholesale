"use client";
import { formatDateIST, toISTDateKey } from "@/lib/datetime";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Truck, ArrowLeft } from "lucide-react";
import { ShipmentDetails } from "@/stores/orderStore";
import { shippingService } from "@/services/shippingService";

interface FulfillmentFormProps {
  orderId: string;
  orderPinCode?: string;
  onShip: (details: ShipmentDetails) => Promise<void>;
  onCancel: () => void;
}

export function FulfillmentForm({ orderId, orderPinCode = "395003", onShip, onCancel }: FulfillmentFormProps) {
  const [shipType, setShipType] = React.useState<"self" | "third-party">("self");
  const [carrierName, setCarrierName] = React.useState("");
  const [trackingId, setTrackingId] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [estDelivery, setEstDelivery] = React.useState("");
  const [dispatchNotes, setDispatchNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Generate track ID for self shipment
  React.useEffect(() => {
    if (shipType === "self") {
      const randNum = Math.floor(100000 + Math.random() * 900000);
      setTrackingId(`FLEX-IN-${orderId.replace("FS-", "")}-${randNum}`);
    } else if (shipType === "third-party") {
      setTrackingId("");
    }
  }, [shipType, orderId]);

  const [uploadShippingLabel, setUploadShippingLabel] = React.useState("");
  const [isUploadingLabel, setIsUploadingLabel] = React.useState(false);

  const handleLabelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLabel(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers: Record<string, string> = {};
      if (typeof document !== "undefined") {
        const matches = document.cookie.match(/csrf_token=([^;]+)/);
        if (matches && matches[1]) {
          headers["X-CSRF-Token"] = matches[1];
        }
      }
      const res = await fetch("/api/customers/upload-document", {
        method: "POST",
        headers,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload shipping label");
      if (data.url) setUploadShippingLabel(data.url);
    } catch (err: any) {
      alert(err.message || "Failed to upload shipping label");
    } finally {
      setIsUploadingLabel(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (shipType === "third-party" && (!carrierName.trim() || !trackingId.trim())) {
      alert("Please provide the Carrier Name and Tracking ID for third-party courier dispatch.");
      return;
    }

    if (!estDelivery.trim()) {
      alert("Please provide the Estimated Delivery Date before dispatching this shipment.");
      return;
    }

    const details: ShipmentDetails = {
      type: shipType,
      carrierName: shipType === "third-party" ? carrierName.trim() : undefined,
      trackingId: trackingId.trim(),
      trackingUrl: shipType === "third-party" ? trackingUrl.trim() || undefined : undefined,
      estimatedDelivery: estDelivery.trim() || undefined,
      shippedAt: formatDateIST(new Date()),
      notes: dispatchNotes.trim() || undefined,
      uploadShippingLabel: shipType === "third-party" ? uploadShippingLabel || undefined : undefined,
    };

    setIsSubmitting(true);
    try {
      await onShip(details);
    } finally {
      setIsSubmitting(false);
    }
  };

  // IST calendar day, not the UTC one. toISOString() rolls over at 05:30 IST, so between
  // midnight and 5:30am the date picker's minimum was yesterday in India.
  const todayStr = toISTDateKey(new Date());

  return (
    <Card className="border border-border">
      <CardHeader className="flex flex-row items-center justify-between border-b p-4">
        <div>
          <CardTitle className="text-sm font-bold uppercase flex items-center gap-1.5 text-primary">
            <Truck className="h-4.5 w-4.5" /> Fulfill Order Shipment
          </CardTitle>
          <CardDescription className="text-[10px] font-mono">{orderId}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Courier Service Option</label>
            <select
              value={shipType}
              onChange={(e) => setShipType(e.target.value as any)}
              className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md font-semibold cursor-pointer h-10"
            >
              <option value="self">FlexSell Self Dispatch (In-House Transport)</option>
              <option value="third-party">Third-Party Courier Services (Manual)</option>
            </select>
          </div>

          {shipType === "third-party" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Carrier Name *</label>
              <Input
                required
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="e.g. BlueDart, Delhivery, DHL"
                className="text-sm"
              />
            </div>
          )}

          <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Tracking / Waybill ID * {shipType === "self" && "(Auto-Generated)"}
              </label>
              <Input
                required
                readOnly={shipType === "self"}
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="e.g. 7849102834"
                className="text-sm font-mono font-bold"
              />
            </div>

          {shipType === "third-party" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Tracking URL Reference</label>
              <Input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://carrier.com/track/id"
                type="url"
                className="text-sm font-mono"
              />
            </div>
          )}

          {shipType === "third-party" && (
            <div className="p-3 bg-secondary/15 border border-border rounded-lg space-y-2">
              <label className="text-xs font-bold text-foreground block">
                Upload Third-Party Shipping Label (Image / PDF)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleLabelUpload}
                disabled={isUploadingLabel}
                className="text-xs block w-full text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
              {isUploadingLabel && (
                <p className="text-[10px] text-primary animate-pulse">Uploading shipping label document...</p>
              )}
              {uploadShippingLabel && !isUploadingLabel && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  ✓ Shipping Label Uploaded
                </p>
              )}
            </div>
          )}

          <div>
              <label htmlFor="est-delivery" className="text-xs font-semibold text-muted-foreground block mb-1">
                Estimated Delivery Date <span className="text-destructive">*</span>
              </label>
              <Input
                id="est-delivery"
                type="date"
                required
                min={todayStr}
                value={estDelivery}
                onChange={(e) => setEstDelivery(e.target.value)}
                className="text-sm cursor-pointer"
              />
            </div>

          <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Dispatch Notes</label>
              <textarea
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Add packages weight, seal numbers or instructions..."
                className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md h-20"
              />
            </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing Dispatch..." : "Confirm Order Dispatch"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
