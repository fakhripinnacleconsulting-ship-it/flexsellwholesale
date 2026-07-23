"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { Database, Mail, ShieldCheck, RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle, Key, Cpu, Activity, Server, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SystemDiagnosticsPage() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [testEmail, setTestEmail] = React.useState("kuldeepmaurya4296@gmail.com");
  const [sendingEmail, setSendingEmail] = React.useState(false);

  const { addToast } = useToastStore();

  const fetchDiagnostics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/system-diagnostics", { cache: "no-store" });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to fetch diagnostics");
      }
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to connect to diagnostics endpoint");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      addToast("Please enter a valid email address.", "warning");
      return;
    }

    setSendingEmail(true);
    try {
      const res = await fetch("/api/system-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testEmail }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.message || "Failed to send test email");
      }

      addToast(result.message, "success");
    } catch (err: any) {
      addToast(err.message || "Test email dispatch failed", "error");
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-10 text-foreground w-full">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 mb-1">
            <Activity className="h-4 w-4" /> Live Production Infrastructure Monitor
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">System & Service Diagnostics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time verification of Vercel Environment Variables, MongoDB Atlas, SMTP Mail (ZeptoMail/Gmail), and API Services.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              <ArrowLeft className="h-4 w-4" /> Back to Store
            </Button>
          </Link>

          <Button
            onClick={fetchDiagnostics}
            disabled={loading}
            size="sm"
            className="gap-2 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Testing..." : "Re-run Diagnostics"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl mb-8 flex items-center gap-3 text-sm font-semibold">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="p-16 border rounded-2xl bg-card text-center space-y-4">
          <RefreshCw className="h-10 w-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-muted-foreground">Running live system diagnostic checks against Vercel environment...</p>
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* Main Grid: MongoDB & Mail */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MongoDB Atlas Test Card */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <Database className="h-5 w-5 text-emerald-600" /> MongoDB Atlas Database
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                    data.mongodb.status.includes("CONNECTED") ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" : "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                  }`}>
                    {data.mongodb.status.includes("CONNECTED") ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {data.mongodb.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Active Database</span>
                    <span className="font-mono font-bold text-foreground">{data.mongodb.databaseName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Connection Latency</span>
                    <span className="font-mono font-bold text-emerald-600">{data.mongodb.latencyMs} ms</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">Vercel MONGODB_URI</span>
                  <div className="p-2 bg-card border rounded font-mono text-[11px] truncate text-foreground">
                    {data.mongodb.maskedUri}
                  </div>
                </div>

                {data.mongodb.error && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-md text-xs">
                    <strong>Error:</strong> {data.mongodb.error}
                  </div>
                )}

                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-2">Collections & Counts</span>
                  <div className="grid grid-cols-2 gap-2">
                    {data.mongodb.collections.map((col: any) => (
                      <div key={col.name} className="flex justify-between items-center p-2 bg-secondary/15 rounded border text-[11px]">
                        <span className="font-medium">{col.name}</span>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">{col.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium">Admin User Account (`role: admin`)</span>
                  {data.mongodb.adminUserFound ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Found ({data.mongodb.adminEmail})
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> Admin Not Found
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SMTP Mail Service Card */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-secondary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <Mail className="h-5 w-5 text-indigo-600" /> SMTP Mail Dispatcher
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                    data.email.connectionVerified ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30" : "bg-rose-500/10 text-rose-600 border border-rose-500/30"
                  }`}>
                    {data.email.connectionVerified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {data.email.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Active Provider</span>
                    <span className="font-bold text-indigo-600">{data.email.provider}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">SMTP Host & Port</span>
                    <span className="font-mono font-bold text-foreground">{data.email.host}:{data.email.port}</span>
                  </div>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">Sender Email (`From`)</span>
                  <div className="p-2 bg-card border rounded font-mono text-[11px] truncate text-foreground">
                    {data.email.from}
                  </div>
                </div>

                {/* Send Live Test Email Form */}
                <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-indigo-600" /> Send Live Test Email
                  </label>
                  <form onSubmit={handleSendTestEmail} className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      className="h-9 text-xs bg-white"
                      disabled={sendingEmail}
                    />
                    <Button
                      type="submit"
                      disabled={sendingEmail}
                      size="sm"
                      className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer"
                    >
                      {sendingEmail ? "Sending..." : "Dispatch Test"}
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Grid: Shiprocket & Environment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Shiprocket Service */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-secondary/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Server className="h-4 w-4 text-amber-500" /> Shiprocket Freight Logistics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-bold text-foreground">{data.shiprocket.status}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Account Email</span>
                  <span className="font-mono text-[11px]">{data.shiprocket.maskedEmail}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Auth Token Status</span>
                  <span className={`font-bold ${data.shiprocket.tokenAcquired ? "text-emerald-600" : "text-amber-600"}`}>
                    {data.shiprocket.tokenAcquired ? "ACQUIRED ✅" : "PENDING"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Vercel Environment Variables Summary */}
            <Card className="md:col-span-2 border border-border shadow-sm">
              <CardHeader className="pb-3 border-b bg-secondary/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Key className="h-4 w-4 text-emerald-600" /> Vercel Environment Variables Audit
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(data.envSummary).map(([key, val]: [string, any]) => (
                    <div key={key} className="p-2.5 bg-secondary/20 border rounded-lg flex flex-col gap-1">
                      <span className="font-bold text-[10px] uppercase text-muted-foreground">{key}</span>
                      <span className="font-mono text-[11px] font-medium text-foreground truncate">{val}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
