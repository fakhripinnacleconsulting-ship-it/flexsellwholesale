"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { Trash2, Plus, Scale, Truck, Save, Rocket, CheckCircle2, XCircle, Copy, Check, RefreshCw } from "lucide-react";
import { shippingService } from "@/services/shippingService";
import { shiprocketService } from "@/services/shiprocketService";
import { ShippingWeightSlab } from "@/types";
import { ShiprocketTable } from "@/components/admin/shiprocket/ShiprocketTable";

export default function AdminShippingPage() {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [b2bFixedCharge, setB2bFixedCharge] = React.useState(150);
  const [slabs, setSlabs] = React.useState<ShippingWeightSlab[]>([]);
  const [activeTab, setActiveTab] = React.useState<"weight" | "b2b" | "shiprocket">("weight");

  // Add slab form states
  const [newFromGram, setNewFromGram] = React.useState("");
  const [newUptoGram, setNewUptoGram] = React.useState("");
  const [newAmount, setNewAmount] = React.useState("");

  // Shiprocket states
  const [srEnabled, setSrEnabled] = React.useState(false);
  const [srEmail, setSrEmail] = React.useState("");
  const [srPassword, setSrPassword] = React.useState("");
  const [srWebhookToken, setSrWebhookToken] = React.useState("");
  const [srChannelId, setSrChannelId] = React.useState("");
  const [pickupName, setPickupName] = React.useState("");
  const [pickupPhone, setPickupPhone] = React.useState("");
  const [pickupAddress, setPickupAddress] = React.useState("");
  const [pickupCity, setPickupCity] = React.useState("");
  const [pickupState, setPickupState] = React.useState("");
  const [pickupPinCode, setPickupPinCode] = React.useState("");

  // Test connection states [UPDATED-6]
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{
    authOk?: boolean;
    channelOk?: boolean;
    pickupOk?: boolean;
    error?: string | null;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = React.useState(false);

  React.useEffect(() => {
    shippingService.getConfig()
      .then((config: any) => {
        if (config) {
          setB2bFixedCharge(config.b2bFixedCharge ?? 150);
          setSlabs(config.weightSlabs || []);

          if (config.shiprocket) {
            setSrEnabled(Boolean(config.shiprocket.enabled));
            setSrEmail(config.shiprocket.email || "");
            setSrPassword(config.shiprocket.password || "");
            setSrWebhookToken(config.shiprocket.webhookToken || "");
            setSrChannelId(config.shiprocket.channelId || "");

            const pa = config.shiprocket.pickupAddress || {};
            setPickupName(pa.name || "");
            setPickupPhone(pa.phone || "");
            setPickupAddress(pa.address || "");
            setPickupCity(pa.city || "");
            setPickupState(pa.state || "");
            setPickupPinCode(pa.pinCode || "");
          }
        }
      })
      .catch((err) => {
        addToast(err.message || "Failed to load shipping settings", "error");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [addToast]);

  const handleAddSlab = (e: React.FormEvent) => {
    e.preventDefault();
    const fromVal = Number(newFromGram);
    const uptoVal = Number(newUptoGram);
    const amountVal = Number(newAmount);

    if (isNaN(fromVal) || fromVal < 0) {
      addToast("Start range must be a valid positive number.", "warning");
      return;
    }
    if (isNaN(uptoVal) || uptoVal <= fromVal) {
      addToast("Upto range must be greater than start range.", "warning");
      return;
    }
    if (isNaN(amountVal) || amountVal < 0) {
      addToast("Shipping amount must be a positive number.", "warning");
      return;
    }

    const overlaps = slabs.some(
      (s) =>
        (fromVal >= s.fromGram && fromVal <= s.uptoGram) ||
        (uptoVal >= s.fromGram && uptoVal <= s.uptoGram) ||
        (fromVal <= s.fromGram && uptoVal >= s.uptoGram)
    );

    if (overlaps) {
      addToast("Weight range overlaps with an existing slab.", "warning");
      return;
    }

    const newSlab: ShippingWeightSlab = {
      fromGram: fromVal,
      uptoGram: uptoVal,
      amount: amountVal,
    };

    setSlabs(prev => [...prev, newSlab].sort((a, b) => a.fromGram - b.fromGram));
    setNewFromGram("");
    setNewUptoGram("");
    setNewAmount("");
    addToast("Shipping slab added. Remember to save changes.", "info");
  };

  const handleRemoveSlab = (index: number) => {
    setSlabs(prev => prev.filter((_, i) => i !== index));
    addToast("Shipping slab removed. Remember to save changes.", "info");
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res: any = await shiprocketService.testConnection({ pickupPinCode });
      setTestResult(res);
      if (res.authOk && res.channelOk && res.pickupOk) {
        addToast("Shiprocket connection test passed successfully!", "success");
      } else {
        addToast(res.error || "Shiprocket connection test failed.", "error");
      }
    } catch (err: any) {
      setTestResult({
        authOk: false,
        channelOk: false,
        pickupOk: false,
        error: err.message || "Connection test request failed."
      });
      addToast(err.message || "Connection test failed", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await shippingService.updateConfig({
        weightSlabs: slabs,
        b2bFixedCharge: Number(b2bFixedCharge),
        shiprocket: {
          enabled: srEnabled,
          email: srEmail,
          password: srPassword,
          webhookToken: srWebhookToken,
          channelId: srChannelId,
          pickupAddress: {
            name: pickupName,
            phone: pickupPhone,
            address: pickupAddress,
            city: pickupCity,
            state: pickupState,
            pinCode: pickupPinCode,
            country: "India",
          }
        }
      } as any);
      addToast("Shipping configuration updated successfully!", "success");
    } catch (err: any) {
      addToast(err.message || "Failed to save shipping settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const originUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  const webhookEndpoints = [
    {
      id: "current",
      label: "Current Active Environment",
      badge: "Current Origin",
      url: `${originUrl}/api/shiprocket/webhook`,
    },
    {
      id: "production",
      label: "Production Primary Domain",
      badge: "flexsellwholesale.com",
      url: "https://flexsellwholesale.com/api/shiprocket/webhook",
    },
    {
      id: "vercel",
      label: "Vercel Cloud Deployment",
      badge: "flexsell.vercel.app",
      url: "https://flexsell.vercel.app/api/shiprocket/webhook",
    },
  ];

  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const copyEndpointUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast("Webhook listener URL copied to clipboard!", "info");
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading shipping settings...</div>;
  }

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Shipping Configuration</h1>
          <p className="text-muted-foreground mt-1">Configure shipping rates and Shiprocket API logistics integration.</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="font-bold flex items-center gap-2 cursor-pointer">
          <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border text-sm font-bold gap-6">
        <button
          onClick={() => setActiveTab("weight")}
          className={`pb-3 transition-all border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === "weight"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Weight-Based Slabs (B2C & Dropshipping)
        </button>
        <button
          onClick={() => setActiveTab("b2b")}
          className={`pb-3 transition-all border-b-2 -mb-[2px] cursor-pointer ${
            activeTab === "b2b"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          B2B Cargo Shipping
        </button>
        <button
          onClick={() => setActiveTab("shiprocket")}
          className={`pb-3 transition-all border-b-2 -mb-[2px] cursor-pointer flex items-center gap-1.5 ${
            activeTab === "shiprocket"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Rocket className="h-4 w-4" /> Shiprocket Integration
        </button>
      </div>

      <div>
        {activeTab === "weight" ? (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" /> Weight-Based Slabs (B2C & Dropshipping)
              </CardTitle>
              <CardDescription>Define shipping charges based on total package weight in grams.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {slabs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground bg-secondary/15 rounded-xl border border-dashed">
                  No weight slabs configured. Shipping will default to Free Shipping.
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg bg-card">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-secondary/40 text-xs uppercase font-bold text-muted-foreground border-b">
                      <tr>
                        <th className="px-4 py-3">Start Range (g)</th>
                        <th className="px-4 py-3">Upto Range (g)</th>
                        <th className="px-4 py-3">Amount (₹)</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {slabs.map((slab, idx) => (
                        <tr key={idx} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-3.5 font-mono">{slab.fromGram} g</td>
                          <td className="px-4 py-3.5 font-mono">{slab.uptoGram} g</td>
                          <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">₹{slab.amount}</td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveSlab(idx)}
                              className="text-destructive hover:bg-destructive/10 h-8 w-8 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Slab Sub-form */}
              <form onSubmit={handleAddSlab} className="p-4 bg-secondary/10 rounded-xl border border-border/40 space-y-4">
                <h4 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">Add New Shipping Slab</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Start Weight (grams)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 0"
                      value={newFromGram}
                      onChange={(e) => setNewFromGram(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Upto Weight (grams)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 500"
                      value={newUptoGram}
                      onChange={(e) => setNewUptoGram(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Shipping Amount (₹)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 50"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" variant="secondary" className="font-bold flex items-center gap-1.5 cursor-pointer">
                  <Plus className="h-3.5 w-3.5" /> Add Weight Slab
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : activeTab === "b2b" ? (
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" /> B2B Shipping
              </CardTitle>
              <CardDescription>Set flat shipping rates for bulk trade orders.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold">B2B Fixed Shipping Charge (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={b2bFixedCharge}
                  onChange={(e) => setB2bFixedCharge(Math.max(0, Number(e.target.value)))}
                  className="font-bold text-lg max-w-xs"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                  This flat rate is automatically applied to all B2B bulk orders at checkout, regardless of cargo weight or package sizes.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* SHIPROCKET TAB */
          <div className="space-y-6">
            {/* Live Shiprocket Logistical Operations Table */}
            <ShiprocketTable />

            <Card className="border border-border space-y-6">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Rocket className="h-5 w-5 text-primary" /> Shiprocket Automated Logistics
                    </CardTitle>
                    <CardDescription>Enable automated order creation, AWB assignment and live tracking via Shiprocket API.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSave} disabled={isSaving} className="font-bold flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground">
                      <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Shiprocket Settings"}
                    </Button>
                    <div className="flex items-center gap-2 bg-secondary/20 px-3 py-1.5 rounded-lg border">
                      <span className="text-xs font-bold">{srEnabled ? "ENABLED" : "DISABLED"}</span>
                      <input
                        type="checkbox"
                        checked={srEnabled}
                        onChange={(e) => setSrEnabled(e.target.checked)}
                        className="h-5 w-5 text-primary rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>

            <CardContent className="space-y-6">
              {/* Credentials sub-form */}
              <div className="space-y-4 border p-4 rounded-xl bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">1. Shiprocket API Credentials</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Account Email *</label>
                    <Input
                      type="email"
                      placeholder="e.g. shiprocket@flexsell.in"
                      value={srEmail}
                      onChange={(e) => setSrEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Account Password * [Encrypted AES-256-GCM]</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={srPassword}
                      onChange={(e) => setSrPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Channel ID (Optional)</label>
                    <Input
                      placeholder="e.g. 102938"
                      value={srChannelId}
                      onChange={(e) => setSrChannelId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Webhook Verification Token (Optional)</label>
                    <Input
                      placeholder="e.g. secret-webhook-token"
                      value={srWebhookToken}
                      onChange={(e) => setSrWebhookToken(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Pickup Address sub-form */}
              <div className="space-y-4 border p-4 rounded-xl bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">2. Origin Pickup Address (Warehouse)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Contact / Warehouse Name *</label>
                    <Input
                      placeholder="e.g. Surat Central Warehouse"
                      value={pickupName}
                      onChange={(e) => setPickupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Contact Phone *</label>
                    <Input
                      placeholder="e.g. 9876543210"
                      value={pickupPhone}
                      onChange={(e) => setPickupPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Street Address *</label>
                  <Input
                    placeholder="e.g. Plot 12, GIDC Sachin Industrial Estate"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">City *</label>
                    <Input
                      placeholder="Surat"
                      value={pickupCity}
                      onChange={(e) => setPickupCity(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">State *</label>
                    <Input
                      placeholder="Gujarat"
                      value={pickupState}
                      onChange={(e) => setPickupState(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Pin Code *</label>
                    <Input
                      placeholder="395003"
                      value={pickupPinCode}
                      onChange={(e) => setPickupPinCode(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Test Connection Button & Results Display [UPDATED-6] */}
              <div className="p-4 border rounded-xl bg-secondary/10 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Test Connection & Serviceability</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Verifies authentication, channel ID, and origin pincode registration.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="font-bold flex items-center gap-2 cursor-pointer text-xs"
                  >
                    {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                    {isTesting ? "Testing..." : "Test Connection"}
                  </Button>
                </div>

                {testResult && (
                  <div className="p-3 bg-background border rounded-lg text-xs space-y-2 font-mono">
                    <div className="flex items-center gap-2">
                      {testResult.authOk ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <span>Authentication Check: {testResult.authOk ? "Passed" : "Failed"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult.channelOk ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <span>Channel Verification: {testResult.channelOk ? "Passed" : "Failed / Optional"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {testResult.pickupOk ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <span>Pickup Pincode Serviceability: {testResult.pickupOk ? "Passed" : "Failed"}</span>
                    </div>

                    {testResult.error && (
                      <div className="mt-2 text-destructive border-t pt-2 font-sans leading-relaxed">
                        ⚠ {testResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Webhook URLs display */}
              <div className="p-4 border rounded-xl bg-card space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Shiprocket Webhook Listener Endpoints</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Copy and paste the URL matching your deployment environment into your Shiprocket Dashboard under <strong>Settings ➔ API ➔ Webhooks</strong>:
                  </p>
                </div>

                <div className="space-y-3">
                  {webhookEndpoints.map((ep) => (
                    <div key={ep.id} className="p-3 bg-secondary/15 rounded-lg border space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">{ep.label}</span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {ep.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input readOnly value={ep.url} className="font-mono text-xs bg-background" />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => copyEndpointUrl(ep.url, ep.id)}
                          className="shrink-0 font-semibold cursor-pointer h-9 px-3"
                        >
                          {copiedId === ep.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                          <span className="ml-1.5 text-xs">{copiedId === ep.id ? "Copied" : "Copy"}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save Button Bar */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={isSaving} size="lg" className="font-bold flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground">
                  <Save className="h-4.5 w-4.5" /> {isSaving ? "Saving Configuration..." : "Save Shiprocket Credentials & Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        )}
      </div>
    </div>
  );
}
