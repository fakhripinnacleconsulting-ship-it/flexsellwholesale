"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { customerService } from "@/services/customerService";
import { Customer, KycDocuments } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { ArrowUpCircle, CheckCircle2, XCircle, Search, FileText, Download, ExternalLink, User, Building, Store, Phone, MapPin } from "lucide-react";

export default function AdminUpgradeRequestsPage() {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const [requests, setRequests] = React.useState<Customer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  const fetchRequests = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerService.getUpgradeRequests();
      setRequests(data);
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to fetch upgrade requests", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = (customerId: string, name: string) => {
    confirmAction({
      title: "Approve Account Upgrade",
      message: `Are you sure you want to approve the wholesale upgrade application for "${name}"? This will combine their requested account tiers and grant wholesale access.`,
      confirmText: "Approve Upgrade",
      type: "info",
      onConfirm: async () => {
        setProcessingId(customerId);
        try {
          await customerService.approveUpgrade(customerId);
          addToast("Customer upgrade approved successfully!", "success");
          fetchRequests();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to approve upgrade", "error");
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  const handleReject = (customerId: string, name: string) => {
    confirmAction({
      title: "Reject Upgrade Request",
      message: `Are you sure you want to reject the upgrade request for "${name}"? Their account status will revert to standard B2C.`,
      confirmText: "Reject Upgrade",
      type: "danger",
      onConfirm: async () => {
        setProcessingId(customerId);
        try {
          await customerService.rejectUpgrade(customerId);
          addToast("Customer upgrade request rejected.", "info");
          fetchRequests();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to reject upgrade", "error");
        } finally {
          setProcessingId(null);
        }
      },
    });
  };

  const filteredRequests = React.useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.company && r.company.toLowerCase().includes(q)) ||
      (r.storeName && r.storeName.toLowerCase().includes(q)) ||
      (r.phone && r.phone.includes(q))
    );
  }, [requests, search]);

  const renderDocThumbnail = (label: string, url?: string) => {
    if (!url) {
      return (
        <div className="border border-dashed border-border rounded-lg p-3 bg-secondary/10 flex flex-col items-center justify-center text-center">
          <FileText className="h-5 w-5 text-muted-foreground/40 mb-1" />
          <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground italic">Not uploaded</span>
        </div>
      );
    }

    const isPdf = url.includes(".pdf") || url.startsWith("data:application/pdf");

    return (
      <div className="border border-border rounded-lg p-3 bg-card flex flex-col justify-between space-y-2 group hover:border-primary transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-foreground truncate">{label}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 p-1 cursor-pointer"
            title="Open Document"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="h-20 bg-secondary/20 rounded flex items-center justify-center overflow-hidden relative border">
          {isPdf ? (
            <div className="flex flex-col items-center text-primary">
              <FileText className="h-8 w-8" />
              <span className="text-[10px] font-extrabold uppercase mt-1">PDF Document</span>
            </div>
          ) : (
            <img src={url} alt={label} className="w-full h-full object-cover" />
          )}
        </div>

        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-1 bg-secondary hover:bg-secondary/80 text-foreground text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-colors"
        >
          <Download className="h-3 w-3" /> View / Download
        </a>
      </div>
    );
  };

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ArrowUpCircle className="h-7 w-7 text-primary" /> Customer Upgrade Requests
          </h1>
          <p className="text-muted-foreground text-sm">
            Review B2B and Dropshipping verification applications and KYC documents.
          </p>
        </div>

        <div className="w-full sm:w-72 relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading pending requests...</div>
      ) : filteredRequests.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="p-12 text-center text-muted-foreground space-y-2">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="font-bold text-base">No Pending Upgrade Requests</h3>
            <p className="text-xs">All customer upgrade requests have been processed.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredRequests.map((cust) => {
            const requested = cust.upgradeRequestedTypes || [];
            const docs: KycDocuments = cust.kycDocuments || {};

            return (
              <Card key={cust._id} className="border border-border shadow-sm">
                <CardHeader className="bg-secondary/15 border-b pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg font-bold">{cust.name}</CardTitle>
                        <span className="text-xs font-mono text-muted-foreground">({cust._id})</span>
                        {requested.map((t) => (
                          <span
                            key={t}
                            className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20"
                          >
                            Requested: {t}
                          </span>
                        ))}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        Submitted application for wholesale tier upgrade
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 font-bold"
                        onClick={() => handleReject(cust._id, cust.name)}
                        disabled={processingId === cust._id}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white font-bold"
                        onClick={() => handleApprove(cust._id, cust.name)}
                        disabled={processingId === cust._id}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Upgrade
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Customer details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-primary" /> Contact Details
                      </span>
                      <p className="font-bold text-foreground">{cust.email}</p>
                      <p className="font-semibold text-muted-foreground">{cust.phone || "No phone"}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <Building className="h-3.5 w-3.5 text-primary" /> Company / GSTIN
                      </span>
                      <p className="font-bold text-foreground">{cust.company || "N/A"}</p>
                      <p className="font-mono font-semibold text-muted-foreground">{cust.gstin ? `GST: ${cust.gstin}` : "No GSTIN"}</p>
                    </div>

                    {cust.storeName && (
                      <div className="space-y-1">
                        <span className="text-muted-foreground font-semibold flex items-center gap-1">
                          <Store className="h-3.5 w-3.5 text-primary" /> Store Name (Dropship)
                        </span>
                        <p className="font-bold text-foreground">{cust.storeName}</p>
                      </div>
                    )}

                    <div className="space-y-1">
                      <span className="text-muted-foreground font-semibold flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> Business Address
                      </span>
                      <p className="font-semibold text-foreground leading-tight">
                        {cust.address}, {cust.city}, {cust.state} - {cust.pinCode}
                      </p>
                    </div>
                  </div>

                  {/* Documents grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Uploaded KYC Documents
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {renderDocThumbnail("GST Certificate", docs.gstCertificate)}
                      {renderDocThumbnail("Signature Photo", docs.signaturePhoto)}
                      {renderDocThumbnail("Aadhar Card", docs.aadharCard)}
                      {renderDocThumbnail("Passport Photo", docs.passportPhoto)}
                      {renderDocThumbnail("PAN Card", docs.panCard)}
                      {renderDocThumbnail("Cancelled Cheque", docs.chequePhoto)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
