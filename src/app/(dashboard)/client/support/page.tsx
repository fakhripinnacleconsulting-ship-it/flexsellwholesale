"use client";
import { formatDateTimeIST } from "@/lib/datetime";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { customerService } from "@/services/customerService";
import { LifeBuoy, Send, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

interface SupportTicket {
  _id: string;
  subject: string;
  message: string;
  status: "new" | "in_progress" | "resolved" | "closed";
  adminNotes?: string;
  createdAt: string;
}

function getStatusBadge(status: SupportTicket["status"]) {
  switch (status) {
    case "resolved":
    case "closed":
      return (
        <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> {status === "resolved" ? "Resolved" : "Closed"}
        </span>
      );
    case "in_progress":
      return (
        <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> In Progress
        </span>
      );
    default:
      return (
        <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Clock className="h-3 w-3" /> New
        </span>
      );
  }
}

export default function ClientSupportPage() {
  const { addToast } = useToastStore();
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerInfo, setCustomerInfo] = React.useState<{ firstName: string; lastName: string; email: string } | null>(null);

  const fetchTickets = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/inquiries");
      if (!res.ok) {
        setTickets([]);
        return;
      }
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load support tickets:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchTickets();
    customerService.getActiveCustomer()
      .then((cust) => {
        const [firstName, ...rest] = (cust.name || "").split(" ");
        setCustomerInfo({ firstName: firstName || "Customer", lastName: rest.join(" ") || "Account", email: cust.email });
      })
      .catch(() => {});
  }, [fetchTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      addToast("Please fill in both subject and message.", "warning");
      return;
    }
    if (!customerInfo) {
      addToast("Please wait for your account details to load.", "warning");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "support",
          firstName: customerInfo.firstName,
          lastName: customerInfo.lastName,
          email: customerInfo.email,
          subject,
          message,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit support ticket");
      addToast("Support ticket submitted! Our team will respond shortly.", "success");
      setSubject("");
      setMessage("");
      fetchTickets();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to submit support ticket", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground">
      <div className="flex items-center gap-3">
        <LifeBuoy className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground text-sm">Raise an issue with our B2B support team and track its status here.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-base font-bold">Raise a New Ticket</CardTitle>
            <CardDescription>Describe your issue and our team will get back to you.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Subject *</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Delayed shipment for order FS-10025" required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Message *</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary"
                  placeholder="Describe your issue in detail..."
                  required
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="font-bold gap-2" disabled={isSubmitting}>
                <Send className="h-4 w-4" /> {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-base font-bold">My Tickets</CardTitle>
            <CardDescription>Track the status of your past support requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No support tickets yet.</p>
            ) : (
              tickets.map((t) => (
                <div key={t._id} className="p-3 border border-border rounded-lg space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-foreground">{t.subject}</h4>
                    {getStatusBadge(t.status)}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.message}</p>
                  {t.adminNotes && (
                    <div className="bg-secondary/35 p-2 rounded border-l-2 border-l-primary text-xs">
                      <span className="font-bold text-primary">Support Team:</span> <span className="text-muted-foreground italic">{t.adminNotes}</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">{formatDateTimeIST(new Date(t.createdAt))}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
