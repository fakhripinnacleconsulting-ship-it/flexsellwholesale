"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { DEFAULT_ID_FORMATS, IdFormatConfig, formatIdPreview } from "@/lib/idGenerator";
import { Search, Hash, RefreshCw, Save, Layers, CreditCard, FileText, Users, ShoppingBag, FolderTree, Tags, MessageSquare, MessageSquarePlus, Percent, HelpCircle, Trash2, Plus } from "lucide-react";
import { CompanyInformationTab, CompanyInfoData } from "@/components/admin/invoice/CompanyInformationTab";

export default function AdminSettingsPage() {
  const { addToast } = useToastStore();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Unified Company & Brand Information state
  const [companyInfo, setCompanyInfo] = React.useState<CompanyInfoData>({
    storeName: "FlexSell Wholesale",
    legalName: "FlexSell Wholesale Sourcing Pvt Ltd",
    gstin: "24AAACF1001M1Z5",
    pan: "AAACF1001M",
    cin: "U51909MP2024PTC012345",
    companyAddress: "Plot No. 12, GIDC Industrial Estate, Sachin",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pinCode: "394230",
    supportEmail: "support@flexsellwholesale.com",
    supportPhone: "+91 88877 66655",
    websiteUrl: "https://flexsellwholesale.com",
    timings: "9:30 AM to 6:30 PM (Sunday Closed)",
    signatureUrl: "",
    bankName: "HDFC Bank",
    accountName: "FlexSell B2B Private Limited",
    accountNumber: "50200084729104",
    ifscCode: "HDFC0000024",
    branchName: "Sachin GIDC, Bhopal",
    termsAndConditions: [
      "All invoices are subject to Bhopal jurisdiction only.",
      "Interest @ 18% p.a. will be charged on payments delayed beyond agreed credit SLAs.",
      "Physical inspection of delivered packages must be reported within 24 hours of arrival.",
      "GST E-Way Bill details are generated directly via API for verified B2B transport."
    ]
  });

  // Commerce settings states
  const [minOrderValue, setMinOrderValue] = React.useState("1000");
  const [defaultTaxRate, setDefaultTaxRate] = React.useState("18");
  const [enableCod, setEnableCod] = React.useState(true);
  const [enableOnlinePayment, setEnableOnlinePayment] = React.useState(true);

  // Footer settings state
  const [footerSettings, setFooterSettings] = React.useState<{
    socialLinks: { id: string; name: string; url: string; iconUrl?: string }[];
    paymentBadges: { id: string; name: string; iconUrl?: string }[];
    footerColumns: { id: string; title: string; links: { label: string; url: string }[] }[];
    showTopCategories: boolean;
  }>({
    socialLinks: [],
    paymentBadges: [],
    footerColumns: [
      {
        id: "default-col-1",
        title: "Business Hub",
        links: [
          { label: "All B2B Products", url: "/products" },
          { label: "Client Orders Ledger", url: "/client/orders" }
        ]
      }
    ],
    showTopCategories: true
  });

  // Navigation tab state
  const [activeTab, setActiveTab] = React.useState<"general" | "id" | "theme" | "footer">("general");

  // ID Formats Data Table state
  const [idFormatsList, setIdFormatsList] = React.useState<IdFormatConfig[]>(DEFAULT_ID_FORMATS);
  const [idSearchTerm, setIdSearchTerm] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "theme" || tabParam === "id" || tabParam === "general" || tabParam === "footer") {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  const handleTabSelect = (tab: "general" | "id" | "theme" | "footer") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.pushState(null, "", url.toString());
    }
  };

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        const res = await fetch("/api/cms");
        if (res.ok) {
          const data = await res.json();
          const bs = data.businessSettings || {};
          const commerce = data.commerceSettings || {};
          const fs = data.footerSettings || {};

          if (fs.socialLinks) {
            setFooterSettings(fs);
          }

          setCompanyInfo((prev) => ({
            ...prev,
            ...bs,
            termsAndConditions: Array.isArray(bs.termsAndConditions) && bs.termsAndConditions.length > 0
              ? bs.termsAndConditions
              : prev.termsAndConditions
          }));

          if (commerce.minOrderValue) setMinOrderValue(commerce.minOrderValue);
          if (commerce.defaultTaxRate) setDefaultTaxRate(commerce.defaultTaxRate);
          if (commerce.enableCod !== undefined) setEnableCod(commerce.enableCod);
          if (commerce.enableOnlinePayment !== undefined) setEnableOnlinePayment(commerce.enableOnlinePayment);

          // Populate idFormats list safely merging defaults
          if (data.idFormats) {
            let loaded: any[] = [];
            if (Array.isArray(data.idFormats)) {
              loaded = data.idFormats;
            } else if (typeof data.idFormats === "object") {
              loaded = Object.values(data.idFormats);
            }

            const merged = DEFAULT_ID_FORMATS.map((def) => {
              const found = loaded.find((item: any) => item.key === def.key);
              return found ? { ...def, ...found } : def;
            });
            setIdFormatsList(merged);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const commerceSettings = { minOrderValue, defaultTaxRate, enableCod, enableOnlinePayment };

      const saveReqs = [
        fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "businessSettings", value: companyInfo }) }),
        fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "commerceSettings", value: commerceSettings }) }),
        fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "idFormats", value: idFormatsList }) }),
        fetch("/api/cms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "footerSettings", value: footerSettings }) }),
      ];

      await Promise.all(saveReqs);
      addToast("Centralized Company & System Settings saved successfully!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save settings", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateIdFormatRow = (key: string, field: keyof IdFormatConfig, val: any) => {
    setIdFormatsList((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          return { ...item, [field]: val };
        }
        return item;
      })
    );
  };

  const handleResetRowDefault = (key: string) => {
    const defaultObj = DEFAULT_ID_FORMATS.find((d) => d.key === key);
    if (!defaultObj) return;
    setIdFormatsList((prev) =>
      prev.map((item) => (item.key === key ? { ...defaultObj } : item))
    );
    addToast(`Reset ${defaultObj.name} ID format to standard defaults`, "info");
  };

  const filteredIdFormats = React.useMemo(() => {
    if (!idSearchTerm.trim()) return idFormatsList;
    const query = idSearchTerm.toLowerCase().trim();
    return idFormatsList.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.prefix.toLowerCase().includes(query) ||
        item.suffix.toLowerCase().includes(query)
    );
  }, [idFormatsList, idSearchTerm]);

  const getResourceIcon = (key: string) => {
    switch (key) {
      case "order": return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case "invoice": return <FileText className="h-4 w-4 text-blue-500" />;
      case "receipt": return <FileText className="h-4 w-4 text-indigo-500" />;
      case "quote": return <FileText className="h-4 w-4 text-purple-500" />;
      case "customer": return <Users className="h-4 w-4 text-amber-500" />;
      case "product": return <ShoppingBag className="h-4 w-4 text-rose-500" />;
      case "category": return <FolderTree className="h-4 w-4 text-teal-500" />;
      case "collection": return <Layers className="h-4 w-4 text-cyan-500" />;
      case "coupon": return <Tags className="h-4 w-4 text-yellow-500" />;
      case "inquiry": return <MessageSquarePlus className="h-4 w-4 text-sky-500" />;
      case "review": return <MessageSquare className="h-4 w-4 text-violet-500" />;
      case "hsn": return <Percent className="h-4 w-4 text-orange-500" />;
      default: return <Hash className="h-4 w-4 text-primary" />;
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System & Store Settings</h1>
          <p className="text-sm text-muted-foreground">Manage corporate details, bank accounts, ID formats, and theme appearance.</p>
        </div>
        <Button onClick={handleSaveAll} disabled={isSaving} className="font-bold cursor-pointer flex items-center gap-1.5">
          <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save All Settings"}
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b gap-4 overflow-x-auto">
        <button
          onClick={() => handleTabSelect("general")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "general" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          General & Bank Settings
        </button>
        <button
          onClick={() => handleTabSelect("id")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "id" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          ID Format Manager
        </button>
        <button
          onClick={() => handleTabSelect("theme")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "theme" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Theme & Appearance
        </button>
        <button
          onClick={() => handleTabSelect("footer")}
          className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "footer" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Footer Configuration
        </button>
      </div>

      {activeTab === "general" ? (
        <div className="space-y-6">
          {/* Single Unified Company & Brand Manager */}
          <CompanyInformationTab companyInfo={companyInfo} setCompanyInfo={setCompanyInfo} />

          {/* Checkout & Commerce Config */}
          <Card className="border border-border lg:col-span-2">
            <CardHeader>
              <CardTitle>Commerce & Payment Configuration</CardTitle>
              <CardDescription>Set global order minimums, default tax rates, and active payment methods.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Minimum Order Value (₹)</label>
                  <Input value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} type="number" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Tax Rate (%)</label>
                  <Input value={defaultTaxRate} onChange={(e) => setDefaultTaxRate(e.target.value)} type="number" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Enable Cash on Delivery (COD)</label>
                  <p className="text-xs text-muted-foreground">Allow COD payment method for buyers.</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableCod}
                  onChange={(e) => setEnableCod(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Enable Online Payments</label>
                  <p className="text-xs text-muted-foreground">Allow Razorpay (UPI, Cards, Netbanking).</p>
                </div>
                <input
                  type="checkbox"
                  checked={enableOnlinePayment}
                  onChange={(e) => setEnableOnlinePayment(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : activeTab === "id" ? (
        <Card className="border border-border shadow-sm">
          <CardHeader className="border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
            <div>
              <CardTitle className="text-xl">Application ID Format Manager</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Maintain dynamic ID prefixes, suffixes, digit padding, and sequence counters across all 11 relevant core application modules.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search module or prefix..."
                value={idSearchTerm}
                onChange={(e) => setIdSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-5">Application Module</th>
                    <th className="py-3 px-4">ID Prefix</th>
                    <th className="py-3 px-4">Sequence Counter</th>
                    <th className="py-3 px-4">Next Generated ID Preview</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredIdFormats.map((row) => {
                    const nextIdFormatted = formatIdPreview(
                      row.prefix,
                      row.startCount,
                      row.padLength,
                      row.suffix,
                      !!row.useHex
                    );

                    return (
                      <React.Fragment key={row.key}>
                        <tr className="hover:bg-secondary/20 transition-colors">
                          {/* Module Title & Description */}
                          <td className="py-3.5 px-5 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-secondary/60 border border-border shrink-0">
                                {getResourceIcon(row.key)}
                              </div>
                              <div>
                                <span className="font-bold text-foreground block text-sm">{row.name}</span>
                                <span className="text-[11px] text-muted-foreground block">{row.description}</span>
                              </div>
                            </div>
                          </td>

                          {/* Prefix Input */}
                          <td className="py-3.5 px-4 align-middle">
                            <Input
                              value={row.prefix}
                              onChange={(e) => handleUpdateIdFormatRow(row.key, "prefix", e.target.value)}
                              placeholder="e.g. ORD-"
                              className="h-8.5 font-mono text-xs w-32 bg-background font-semibold"
                            />
                          </td>

                          {/* Sequence Counter Input */}
                          <td className="py-3.5 px-4 align-middle">
                            <Input
                              type="number"
                              value={row.startCount}
                              onChange={(e) => handleUpdateIdFormatRow(row.key, "startCount", Number(e.target.value) || 1)}
                              className="h-8.5 font-mono text-xs w-32 bg-background font-semibold"
                            />
                          </td>

                          {/* Next ID Preview Badge */}
                          <td className="py-3.5 px-4 align-middle">
                            <span className="inline-flex items-center px-3.5 py-1.5 rounded-md text-xs font-mono font-bold bg-primary/10 text-primary border border-primary/20 shadow-xs">
                              {nextIdFormatted}
                            </span>
                          </td>

                          {/* Actions: Reset button */}
                          <td className="py-3.5 px-5 align-middle text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Reset to default format"
                                onClick={() => handleResetRowDefault(row.key)}
                                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-secondary"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-border bg-secondary/10 flex items-center justify-between text-xs text-muted-foreground">
              <span>Showing {filteredIdFormats.length} application module ID formats</span>
              <Button onClick={handleSaveAll} disabled={isSaving} size="sm" className="font-bold cursor-pointer">
                {isSaving ? "Saving ID Formats..." : "Save ID Formats"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : activeTab === "footer" ? (
        <div className="space-y-6">
          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Dynamic Social Links</CardTitle>
                <CardDescription>Add unlimited social links. Leave Icon URL blank to use a fallback link icon.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setFooterSettings({...footerSettings, socialLinks: [...footerSettings.socialLinks, {id: Date.now().toString(), name: '', url: '', iconUrl: ''}]})}><Plus className="h-4 w-4 mr-2" /> Add Link</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {footerSettings.socialLinks.map((link, idx) => (
                <div key={link.id} className="flex gap-2 items-center bg-secondary/20 p-3 rounded-lg border">
                  <Input placeholder="Name (e.g. Facebook)" value={link.name} onChange={(e) => { const n = [...footerSettings.socialLinks]; n[idx].name = e.target.value; setFooterSettings({...footerSettings, socialLinks: n}); }} className="w-1/4" />
                  <Input placeholder="URL (https://...)" value={link.url} onChange={(e) => { const n = [...footerSettings.socialLinks]; n[idx].url = e.target.value; setFooterSettings({...footerSettings, socialLinks: n}); }} className="flex-1" />
                  <Input placeholder="Icon URL (optional image/svg)" value={link.iconUrl} onChange={(e) => { const n = [...footerSettings.socialLinks]; n[idx].iconUrl = e.target.value; setFooterSettings({...footerSettings, socialLinks: n}); }} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => { const n = footerSettings.socialLinks.filter(l => l.id !== link.id); setFooterSettings({...footerSettings, socialLinks: n}); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {footerSettings.socialLinks.length === 0 && <p className="text-sm text-muted-foreground italic">No social links added yet.</p>}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Payment Badges</CardTitle>
                <CardDescription>Add custom payment badges displayed at the bottom.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setFooterSettings({...footerSettings, paymentBadges: [...footerSettings.paymentBadges, {id: Date.now().toString(), name: '', iconUrl: ''}]})}><Plus className="h-4 w-4 mr-2" /> Add Badge</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {footerSettings.paymentBadges.map((badge, idx) => (
                <div key={badge.id} className="flex gap-2 items-center bg-secondary/20 p-3 rounded-lg border">
                  <Input placeholder="Badge Name (e.g. UPI)" value={badge.name} onChange={(e) => { const n = [...footerSettings.paymentBadges]; n[idx].name = e.target.value; setFooterSettings({...footerSettings, paymentBadges: n}); }} className="flex-1" />
                  <Input placeholder="Icon URL (optional image/svg)" value={badge.iconUrl} onChange={(e) => { const n = [...footerSettings.paymentBadges]; n[idx].iconUrl = e.target.value; setFooterSettings({...footerSettings, paymentBadges: n}); }} className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => { const n = footerSettings.paymentBadges.filter(b => b.id !== badge.id); setFooterSettings({...footerSettings, paymentBadges: n}); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {footerSettings.paymentBadges.length === 0 && <p className="text-sm text-muted-foreground italic">No payment badges added yet.</p>}
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Footer Navigation Columns</CardTitle>
                <CardDescription>Configure the columns of links displayed in the footer (e.g. Business Hub).</CardDescription>
              </div>
              <Button size="sm" onClick={() => setFooterSettings({...footerSettings, footerColumns: [...footerSettings.footerColumns, {id: Date.now().toString(), title: 'New Column', links: []}]})}><Plus className="h-4 w-4 mr-2" /> Add Column</Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {footerSettings.footerColumns.map((col, cIdx) => (
                <div key={col.id} className="bg-secondary/10 p-4 rounded-xl border space-y-4 relative">
                  <div className="flex gap-4 items-center">
                    <Input className="font-bold flex-1" value={col.title} onChange={(e) => { const cols = [...footerSettings.footerColumns]; cols[cIdx].title = e.target.value; setFooterSettings({...footerSettings, footerColumns: cols}); }} placeholder="Column Title" />
                    <Button variant="destructive" size="sm" onClick={() => { const cols = footerSettings.footerColumns.filter(c => c.id !== col.id); setFooterSettings({...footerSettings, footerColumns: cols}); }}><Trash2 className="h-4 w-4 mr-2" /> Remove Column</Button>
                  </div>
                  <div className="pl-4 border-l-2 space-y-3">
                    {col.links.map((link, lIdx) => (
                       <div key={lIdx} className="flex gap-2">
                         <Input placeholder="Link Label" value={link.label} onChange={(e) => { const cols = [...footerSettings.footerColumns]; cols[cIdx].links[lIdx].label = e.target.value; setFooterSettings({...footerSettings, footerColumns: cols}); }} className="flex-1 text-sm h-8" />
                         <Input placeholder="URL Route" value={link.url} onChange={(e) => { const cols = [...footerSettings.footerColumns]; cols[cIdx].links[lIdx].url = e.target.value; setFooterSettings({...footerSettings, footerColumns: cols}); }} className="flex-1 text-sm h-8" />
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const cols = [...footerSettings.footerColumns]; cols[cIdx].links.splice(lIdx, 1); setFooterSettings({...footerSettings, footerColumns: cols}); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                       </div>
                    ))}
                    <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={() => { const cols = [...footerSettings.footerColumns]; cols[cIdx].links.push({label: '', url: ''}); setFooterSettings({...footerSettings, footerColumns: cols}); }}><Plus className="h-3 w-3 mr-1"/> Add Link</Button>
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t mt-4 flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Show Top Categories Column</h4>
                  <p className="text-xs text-muted-foreground">Automatically fetch and display top 3 categories as a column in the footer</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={footerSettings.showTopCategories} 
                  onChange={(e) => setFooterSettings({...footerSettings, showTopCategories: e.target.checked})} 
                  className="h-5 w-5" 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ThemeEditor />
      )}
    </div>
  );
}

