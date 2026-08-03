"use client";

import * as React from "react";
import { Mail, Phone, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";

interface InquiryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  inquiry: any;
}

export function InquiryDetailsModal({ isOpen, onClose, onSuccess, inquiry }: InquiryDetailsModalProps) {
  const { addToast } = useToastStore();
  const [isSaving, setIsSaving] = React.useState(false);
  const [status, setStatus] = React.useState(inquiry?.status || "new");
  const [adminNotes, setAdminNotes] = React.useState(inquiry?.adminNotes || "");

  React.useEffect(() => {
    if (isOpen && inquiry) {
      setStatus(inquiry.status || "new");
      setAdminNotes(inquiry.adminNotes || "");
    }
  }, [isOpen, inquiry]);

  if (!isOpen || !inquiry) return null;

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiry._id, status: newStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
      addToast(`Inquiry status updated to '${newStatus}'`, "success");
      setStatus(newStatus);
      onSuccess();
    } catch (err: any) {
      addToast(err.message || "Failed to update inquiry", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inquiry._id, adminNotes })
      });
      if (!res.ok) throw new Error("Failed to save admin notes");
      addToast("Admin notes saved successfully", "success");
      onSuccess();
    } catch (err: any) {
      addToast(err.message || "Failed to save notes", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold tracking-tight">{inquiry.subject}</h3>
            <p className="text-muted-foreground text-xs mt-1">
              Submitted on {new Date(inquiry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-secondary/15 p-4 rounded-xl text-xs">
          <div className="space-y-2">
            <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Contact Details</p>
            <p className="font-semibold text-foreground text-sm">{inquiry.firstName} {inquiry.lastName}</p>
            <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" /> {inquiry.email}</p>
            {inquiry.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /> {inquiry.phone}</p>}
            {inquiry.company && <p className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 text-primary" /> {inquiry.company}</p>}
          </div>
          {inquiry.expectedOrders && (
            <div className="space-y-2">
              <p className="font-bold text-foreground uppercase tracking-wider text-[10px]">Dropship Estimates</p>
              <p>Expected Monthly Volume: <span className="font-bold text-primary">{inquiry.expectedOrders}</span></p>
              {inquiry.productInterests && inquiry.productInterests.length > 0 && (
                <p>Interests: {inquiry.productInterests.join(", ")}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Inquiry Message</p>
          <div className="p-4 bg-background border rounded-xl text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {inquiry.message}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Update Status</label>
            <div className="flex flex-wrap gap-2">
              {(["new", "in_progress", "resolved", "closed"] as const).map(st => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(st)}
                  className={`px-3 py-1.5 rounded text-xs font-bold capitalize transition-all cursor-pointer ${
                    status === st ? "bg-primary text-primary-foreground shadow" : "bg-secondary text-muted-foreground hover:text-foreground"
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
              <Button size="sm" variant="ghost" onClick={handleSaveNotes} disabled={isSaving} className="h-7 text-xs text-primary font-bold">
                <Save className="h-3.5 w-3.5 mr-1" /> Save Notes
              </Button>
            </div>
            <textarea
              rows={3}
              placeholder="Add internal notes (e.g. Followed up on phone on 21/7, quote sent)..."
              className="w-full p-2.5 text-xs border rounded-lg bg-background text-foreground focus:ring-1 focus:ring-primary"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
