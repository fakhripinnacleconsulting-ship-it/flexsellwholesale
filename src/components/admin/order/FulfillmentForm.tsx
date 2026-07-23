"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Truck, ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Rocket } from "lucide-react";
import { ShipmentDetails } from "@/stores/orderStore";
import { shippingService } from "@/services/shippingService";
import { shiprocketService } from "@/services/shiprocketService";

interface FulfillmentFormProps {
  orderId: string;
  orderPinCode?: string;
  onShip: (details: ShipmentDetails) => Promise<void>;
  onCancel: () => void;
}

export function FulfillmentForm({ orderId, orderPinCode = "395003", onShip, onCancel }: FulfillmentFormProps) {
  const [shipType, setShipType] = React.useState<"self" | "third-party" | "shiprocket">("self");
  const [carrierName, setCarrierName] = React.useState("");
  const [trackingId, setTrackingId] = React.useState("");
  const [trackingUrl, setTrackingUrl] = React.useState("");
  const [estDelivery, setEstDelivery] = React.useState("");
  const [dispatchNotes, setDispatchNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Shiprocket states
  const [srStatus, setSrStatus] = React.useState<{ enabled: boolean; configured: boolean }>({ enabled: false, configured: false });
  const [srCouriers, setSrCouriers] = React.useState<any[]>([]);
  const [selectedCourierId, setSelectedCourierId] = React.useState<number | null>(null);
  const [isLoadingCouriers, setIsLoadingCouriers] = React.useState(false);
  const [srError, setSrError] = React.useState<string | null>(null);

  // Check Shiprocket status on mount
  React.useEffect(() => {
    shippingService.getShiprocketStatus().then((status) => {
      setSrStatus(status);
    }).catch(console.error);
  }, []);

  // Fetch serviceability when Shiprocket is selected
  React.useEffect(() => {
    if (shipType === "shiprocket") {
      setIsLoadingCouriers(true);
      setSrError(null);
      shiprocketService.checkServiceability({
        deliveryPinCode: orderPinCode,
        weight: 0.5,
      })
        .then((res: any) => {
          const list = res?.data?.available_courier_companies || res?.available_courier_companies || [];
          setSrCouriers(list);
          if (list.length > 0) {
            setSelectedCourierId(list[0].courier_company_id);
          }
        })
        .catch((err: any) => {
          setSrError(err.message || "Failed to load Shiprocket couriers for this pincode.");
        })
        .finally(() => {
          setIsLoadingCouriers(false);
        });
    }
  }, [shipType, orderPinCode]);

  // Generate track ID for self shipment
  React.useEffect(() => {
    if (shipType === "self") {
      const randNum = Math.floor(100000 + Math.random() * 900000);
      setTrackingId(`FLEX-IN-${orderId.replace("FS-", "")}-${randNum}`);
    } else if (shipType === "third-party") {
      setTrackingId("");
    }
  }, [shipType, orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSrError(null);

    if (shipType === "third-party" && (!carrierName.trim() || !trackingId.trim())) {
      alert("Please provide the Carrier Name and Tracking ID for third-party courier dispatch.");
      return;
    }

    if (shipType === "shiprocket") {
      setIsSubmitting(true);
      try {
        const res: any = await shiprocketService.fulfillOrder(orderId, selectedCourierId || undefined);
        if (!res.success && res.error) {
          setSrError(res.error);
          return;
        }
        // Trigger onShip with returned order's shipment details
        await onShip(res.order?.shipmentDetails || {
          type: "shiprocket",
          carrierName: "Shiprocket Partner",
          trackingId: res.order?.shipmentDetails?.trackingId || "SR-PENDING",
        });
      } catch (err: any) {
        setSrError(err.message || "Shiprocket order fulfillment failed.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const details: ShipmentDetails = {
      type: shipType,
      carrierName: shipType === "third-party" ? carrierName.trim() : undefined,
      trackingId: trackingId.trim(),
      trackingUrl: shipType === "third-party" ? trackingUrl.trim() || undefined : undefined,
      estimatedDelivery: estDelivery.trim() || undefined,
      shippedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      notes: dispatchNotes.trim() || undefined,
    };

    setIsSubmitting(true);
    try {
      await onShip(details);
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

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
              <option value="self">FlexSell Self Dispatch (In-House Cargo)</option>
              <option value="third-party">Third-Party Courier Services (Manual)</option>
              {srStatus.enabled && srStatus.configured && (
                <option value="shiprocket">🚀 Shiprocket (Automated API Booking)</option>
              )}
            </select>
            {(!srStatus.enabled || !srStatus.configured) && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Note: Shiprocket option is hidden because it is not enabled/configured in Shipping Settings.
              </p>
            )}
          </div>

          {/* SHIPROCKET SELECTION PANEL */}
          {shipType === "shiprocket" && (
            <div className="p-3.5 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Rocket className="h-4 w-4" /> Select Shiprocket Courier Partner
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Dest Pincode: {orderPinCode}</span>
              </div>

              {isLoadingCouriers ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Checking live courier serviceability...
                </div>
              ) : srCouriers.length > 0 ? (
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {srCouriers.map((c: any) => (
                    <label
                      key={c.courier_company_id}
                      className={`flex items-center justify-between p-2.5 rounded border text-xs cursor-pointer transition-colors ${
                        selectedCourierId === c.courier_company_id
                          ? "border-primary bg-primary/10 font-bold"
                          : "border-border/60 hover:bg-secondary/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="shiprocket_courier"
                          checked={selectedCourierId === c.courier_company_id}
                          onChange={() => setSelectedCourierId(c.courier_company_id)}
                          className="h-3.5 w-3.5 text-primary"
                        />
                        <div>
                          <span className="text-foreground">{c.courier_name}</span>
                          <span className="text-[10px] text-muted-foreground block">
                            ETD: {c.etd || '2-4 Days'} {c.cod ? '• COD Supported' : ''}
                          </span>
                        </div>
                      </div>
                      <span className="text-emerald-600 font-bold">₹{c.rate || c.freight_charge}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  No explicit courier rates returned. Shiprocket will auto-assign optimal carrier upon booking.
                </div>
              )}

              {srError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{srError}</div>
                </div>
              )}
            </div>
          )}

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

          {shipType !== "shiprocket" && (
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
          )}

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

          {shipType !== "shiprocket" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Estimated Delivery Date</label>
              <Input
                type="date"
                min={todayStr}
                value={estDelivery}
                onChange={(e) => setEstDelivery(e.target.value)}
                className="text-sm cursor-pointer"
              />
            </div>
          )}

          {shipType !== "shiprocket" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Dispatch Notes</label>
              <textarea
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                placeholder="Add packages weight, seal numbers or instructions..."
                className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md h-20"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (shipType === "shiprocket" && (Boolean(srError) || isLoadingCouriers))}
              className="font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing Booking..." : shipType === "shiprocket" ? "Book & Generate AWB" : "Confirm Order Dispatch"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
