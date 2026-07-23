"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { pushService } from "@/lib/push/pushService";
import { sendSystemOSNotification } from "@/lib/browserNotifications";
import { Bell, BellOff, CheckCircle2, AlertTriangle, ShieldCheck, Truck, CreditCard, FileText, ShoppingBag, Lock, Send } from "lucide-react";

interface NotificationPreferencesCardProps {
  userId?: string;
  role?: "customer" | "admin";
}

export function NotificationPreferencesCard({ userId = "current", role = "customer" }: NotificationPreferencesCardProps) {
  const { addToast } = useToastStore();
  const [permissionState, setPermissionState] = React.useState<NotificationPermission | "unsupported">("default");
  const [isLoading, setIsLoading] = React.useState(false);
  const [categories, setCategories] = React.useState({
    orders: true,
    shipments: true,
    payments: true,
    quotes: true,
    invoices: true,
    security: true,
  });

  React.useEffect(() => {
    setPermissionState(pushService.getPermissionState());
  }, []);

  const handleEnablePush = async () => {
    setIsLoading(true);
    const result = await pushService.requestPermissionAndSubscribe(role, userId);
    setIsLoading(false);

    setPermissionState(pushService.getPermissionState());
    if (result.success) {
      addToast(result.message, "success");
      sendSystemOSNotification("FlexSell System Notifications Active!", {
        body: "You will receive real-time OS popups for order updates, shipments, and security alerts.",
        link: "/client/notifications",
      });
    } else {
      addToast(result.message, result.message.includes("blocked") ? "warning" : "error");
    }
  };

  const handleSendTestOSNotif = () => {
    if (permissionState !== "granted") {
      addToast("Please enable system notifications first", "warning");
      return;
    }
    sendSystemOSNotification("FlexSell Test Notification", {
      body: "System OS notifications are active and working on your device!",
      link: "/client/notifications",
    });
    addToast("Test system OS notification dispatched!", "success");
  };

  const handleDisablePush = async () => {
    setIsLoading(true);
    await pushService.unsubscribePush(userId);
    setIsLoading(false);
    addToast("Browser push notifications disabled.", "info");
  };

  const handleToggleCategory = (catKey: keyof typeof categories) => {
    setCategories((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
    addToast("Notification category preference updated", "info");
  };

  return (
    <Card className="border border-border shadow-xs">
      <CardHeader className="border-b border-border p-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Notification & Web Push Preferences</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Control real-time browser push alerts and email notification channels.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6 text-xs">
        {/* Browser Permission Status Banner */}
        <div className="border border-border rounded-xl p-4 bg-secondary/15 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="font-bold text-sm text-foreground block">Browser Push Status</span>
              <div className="flex items-center gap-2">
                {permissionState === "granted" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active & Enabled
                  </span>
                ) : permissionState === "denied" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <AlertTriangle className="h-3.5 w-3.5" /> Blocked in Browser Settings
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-secondary text-muted-foreground border border-border">
                    <BellOff className="h-3.5 w-3.5" /> Not Configured
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {permissionState === "granted" && (
                <Button variant="outline" size="sm" onClick={handleSendTestOSNotif} className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Send className="h-3.5 w-3.5 text-primary" /> Test System OS Alert
                </Button>
              )}
              {permissionState === "granted" ? (
                <Button variant="ghost" size="sm" onClick={handleDisablePush} disabled={isLoading} className="text-xs text-muted-foreground hover:text-foreground">
                  Disable
                </Button>
              ) : (
                <Button size="sm" onClick={handleEnablePush} disabled={isLoading || permissionState === "unsupported"} className="font-bold cursor-pointer">
                  {isLoading ? "Enabling..." : "Enable System OS Notifications"}
                </Button>
              )}
            </div>
          </div>

          {permissionState === "granted" && (
            <div className="p-3 bg-primary/5 border border-primary/15 rounded-lg text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-primary" /> Windows / Desktop OS Tip
              </p>
              <p className="leading-relaxed">
                If desktop popup alerts do not appear in the bottom-right corner of your monitor, ensure <strong>Windows "Focus Assist / Do Not Disturb"</strong> is turned OFF in your Windows Action Center (Win + N key).
              </p>
            </div>
          )}

          {permissionState === "denied" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300 space-y-1.5 mt-2">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Notifications are blocked by your browser
              </p>
              <p className="text-[11px] leading-relaxed">
                To re-enable notifications: Click the <strong>padlock / site settings icon</strong> next to the URL bar in your browser address bar ➔ Set <strong>Notifications</strong> permission to <strong>Allow</strong> ➔ Refresh page.
              </p>
            </div>
          )}
        </div>

        {/* Category Switches */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground border-b pb-1.5">
            Notification Category Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "orders", label: "Purchase Orders & Status Updates", icon: <ShoppingBag className="h-4 w-4 text-emerald-500" />, desc: "Order creation, status updates & modifications" },
              { key: "shipments", label: "Cargo & Shipment Dispatch", icon: <Truck className="h-4 w-4 text-blue-500" />, desc: "Courier tracking IDs and dispatch notices" },
              { key: "payments", label: "Payments & Verification", icon: <CreditCard className="h-4 w-4 text-purple-500" />, desc: "Payment confirmations & receipts" },
              { key: "quotes", label: "Proforma Quotes & RFQs", icon: <FileText className="h-4 w-4 text-indigo-500" />, desc: "Wholesale proforma quotes and pricing negotiations" },
              { key: "invoices", label: "GST Tax Invoices & Billing", icon: <FileText className="h-4 w-4 text-teal-500" />, desc: "Official GST tax invoices issued for orders" },
              { key: "security", label: "Account & Security Alerts", icon: <ShieldCheck className="h-4 w-4 text-rose-500" />, desc: "Password resets, profile updates, and login security" },
            ].map((cat) => {
              const isChecked = categories[cat.key as keyof typeof categories];
              return (
                <div key={cat.key} className="flex items-start justify-between p-3 border border-border rounded-lg bg-background hover:bg-secondary/10 transition-colors">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-md bg-secondary/50 border border-border mt-0.5">
                      {cat.icon}
                    </div>
                    <div>
                      <span className="font-bold text-foreground block text-xs">{cat.label}</span>
                      <span className="text-[11px] text-muted-foreground block">{cat.desc}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleCategory(cat.key as keyof typeof categories)}
                    className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer mt-1"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
