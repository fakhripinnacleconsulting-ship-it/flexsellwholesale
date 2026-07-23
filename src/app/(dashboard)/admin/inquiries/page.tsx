"use client";

import * as React from "react";
import { Search, Filter, Mail, Phone, Building2, Calendar, Tag, CheckCircle2, Clock, AlertCircle, Trash2, Save, MessageSquarePlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";

interface Inquiry {
  _id: string;
  category: "wholesale" | "dropshipping" | "support" | "franchise" | "general";
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  adminNotes?: string;
  expectedOrders?: string;
  productInterests?: string[];
  createdAt: string;
}

export default function AdminInquiriesPage() {
  const { addToast } = useToastStore();
  const [inquiries, setInquiries] = React.useState<Inquiry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editNotes, setEditNotes] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    fetchInquiries();
  }, [activeTab]);

  const fetchInquiries = async () => {
    try {
      setIsLoading(true);
      const url = activeTab === "all" ? "/api/inquiries" : `/api/inquiries?category=${activeTab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load inquiries");
      const data = await res.json();
      setInquiries(data);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to load customer inquiries", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!res.ok) throw new Error("Failed to update status");
      addToast(`Inquiry status updated to '${status}'`, "success");
      setInquiries(prev => prev.map(inq => inq._id === id ? { ...inq, status: status as any } : inq));
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to update inquiry", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      setIsSaving(true);
      const notes = editNotes[id] ?? "";
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, adminNotes: notes })
      });
      if (!res.ok) throw new Error("Failed to save admin notes");
      addToast("Admin notes saved successfully", "success");
      setInquiries(prev => prev.map(inq => inq._id === id ? { ...inq, adminNotes: notes } : inq));
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save notes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredInquiries = inquiries.filter(inq => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inq.firstName.toLowerCase().includes(q) ||
      inq.lastName.toLowerCase().includes(q) ||
      inq.email.toLowerCase().includes(q) ||
      (inq.company && inq.company.toLowerCase().includes(q)) ||
      inq.subject.toLowerCase().includes(q) ||
      inq.message.toLowerCase().includes(q)
    );
  });

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "wholesale":
        return <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Wholesale</span>;
      case "dropshipping":
        return <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Dropshipping</span>;
      case "support":
        return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Support</span>;
      case "franchise":
        return <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Franchise</span>;
      default:
        return <span className="bg-secondary text-muted-foreground text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">General</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase">New</span>;
      case "in_progress":
        return <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase">In Progress</span>;
      case "resolved":
        return <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase">Resolved</span>;
      case "closed":
        return <span className="bg-slate-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase">Closed</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <MessageSquarePlus className="h-8 w-8 text-primary" /> Customer Inquiries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Categorized inbox for wholesale quotes, dropshipper onboardings, and support inquiries.</p>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex border-b gap-2 overflow-x-auto">
        {[
          { id: "all", label: "All Inquiries" },
          { id: "wholesale", label: "Wholesale Sourcing" },
          { id: "dropshipping", label: "Dropshipping" },
          { id: "support", label: "Support & Claims" },
          { id: "franchise", label: "Franchise" },
          { id: "general", label: "General" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 border-b-2 font-semibold text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, company, or message text..."
            className="pl-9 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Inquiries Table List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-sm text-muted-foreground">Loading inquiries...</span>
        </div>
      ) : filteredInquiries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="font-bold text-foreground">No inquiries found</p>
            <p className="text-xs">Inquiries submitted from storefront forms will appear here under their category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inq) => {
            const isExpanded = expandedId === inq._id;
            return (
              <Card key={inq._id} className={`border transition-all ${isExpanded ? "border-primary/50 shadow-md" : "border-border hover:border-primary/20"}`}>
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar Summary Row */}
                  <div
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
                    onClick={() => {
                      setExpandedId(isExpanded ? null : inq._id);
                      if (!editNotes[inq._id]) {
                        setEditNotes(prev => ({ ...prev, [inq._id]: inq.adminNotes || "" }));
                      }
                    }}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoryBadge(inq.category)}
                        {getStatusBadge(inq.status)}
                        <h3 className="font-bold text-base text-foreground">{inq.subject}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-4 pt-1">
                        <span className="font-semibold text-foreground">{inq.firstName} {inq.lastName}</span>
                        <span>• {inq.email}</span>
                        {inq.company && <span>• {inq.company}</span>}
                        <span>• {new Date(inq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </p>
                    </div>

                    <Button variant="ghost" size="sm" className="text-xs text-primary font-bold">
                      {isExpanded ? "Hide Details" : "View & Respond"}
                    </Button>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="pt-4 border-t space-y-6 animate-fade-in">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/15 p-4 rounded-xl text-xs">
                        <div className="space-y-2">
                          <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Contact Details</p>
                          <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" /> {inq.email}</p>
                          {inq.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /> {inq.phone}</p>}
                          {inq.company && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" /> {inq.company}</p>}
                        </div>
                        {inq.expectedOrders && (
                          <div className="space-y-2">
                            <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Dropship Estimates</p>
                            <p>Expected Monthly Volume: <span className="font-bold text-primary">{inq.expectedOrders}</span></p>
                            {inq.productInterests && inq.productInterests.length > 0 && (
                              <p>Interests: {inq.productInterests.join(", ")}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Message Body */}
                      <div className="space-y-1.5">
                        <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Inquiry Message</p>
                        <div className="p-4 bg-background border rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                          {inq.message}
                        </div>
                      </div>

                      {/* Status & Admin Notes Controls */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Update Status</label>
                          <div className="flex gap-2">
                            {(["new", "in_progress", "resolved", "closed"] as const).map(st => (
                              <button
                                key={st}
                                onClick={() => handleUpdateStatus(inq._id, st)}
                                className={`px-3 py-1.5 rounded text-xs font-bold capitalize transition-all cursor-pointer ${
                                  inq.status === st ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:text-foreground"
                                }`}
                              >
                                {st.replace("_", " ")}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Internal Admin Notes</label>
                            <Button size="sm" variant="ghost" onClick={() => handleSaveNotes(inq._id)} disabled={isSaving} className="h-7 text-xs text-primary font-bold">
                              <Save className="h-3.5 w-3.5 mr-1" /> Save Notes
                            </Button>
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Add internal notes (e.g. Followed up on phone on 21/7, quote sent)..."
                            className="w-full p-2.5 text-xs border rounded-lg bg-background text-foreground focus:ring-1 focus:ring-primary"
                            value={editNotes[inq._id] ?? inq.adminNotes ?? ""}
                            onChange={(e) => setEditNotes({ ...editNotes, [inq._id]: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
