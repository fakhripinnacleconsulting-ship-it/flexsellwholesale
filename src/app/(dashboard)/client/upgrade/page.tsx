"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { customerService } from "@/services/customerService";
import { Customer, KycDocuments } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { validateCustomerKycRequirements } from "@/lib/kycValidationHelper";
import { ArrowUpCircle, Upload, CheckCircle2, Clock, AlertTriangle, XCircle, FileText, X } from "lucide-react";
import Image from "next/image";

import { INDIAN_STATES } from "@/lib/constants";

interface DocSlot {
  key: keyof KycDocuments;
  label: string;
  required: boolean;
}

const DOCUMENT_SLOTS: DocSlot[] = [
  { key: "panCard", label: "PAN Card", required: false },
  { key: "aadharCard", label: "Aadhar Card", required: false },
  { key: "signaturePhoto", label: "Signature Photo", required: false },
  { key: "gstCertificate", label: "GST Certificate (Optional)", required: false },
  { key: "passportPhoto", label: "Passport Photo (Optional)", required: false },
  { key: "chequePhoto", label: "Cancelled Cheque (Optional)", required: false },
];

export default function UpgradeAccountPage() {
  const { addToast } = useToastStore();
  const [activeCustomer, setActiveCustomer] = React.useState<Customer | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Form state
  const [requestedTypes, setRequestedTypes] = React.useState<("B2B" | "Dropshipping")[]>(["B2B"]);
  const [company, setCompany] = React.useState("");
  const [storeName, setStoreName] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");

  const [kycDocs, setKycDocs] = React.useState<KycDocuments>({});
  const [uploadingSlot, setUploadingSlot] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    customerService.getActiveCustomer()
      .then((cust) => {
        setActiveCustomer(cust);
        setCompany(cust.company || "");
        setStoreName(cust.storeName || "");
        setGstin(cust.gstin || "");
        setPhone(cust.phone || "");
        setAddress(cust.address || "");
        setCity(cust.city || "");
        setState(cust.state || INDIAN_STATES[0]);
        setPinCode(cust.pinCode || "");
        if (cust.kycDocuments) setKycDocs(cust.kycDocuments);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleFileUpload = async (slotKey: keyof KycDocuments, file: File) => {
    if (file.size > 1024 * 1024) {
      addToast("File size exceeds 1 MB limit. Please upload a smaller file.", "error");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      addToast("Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.", "error");
      return;
    }

    setUploadingSlot(slotKey);
    try {
      const res = await customerService.uploadDocument(file);
      setKycDocs((prev) => ({ ...prev, [slotKey]: res.url }));
      addToast(`${DOCUMENT_SLOTS.find(s => s.key === slotKey)?.label} uploaded successfully!`, "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Document upload failed", "error");
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedTypes.length === 0) {
      addToast("Please select at least one upgrade type (B2B or Dropshipping).", "warning");
      return;
    }

    if (requestedTypes.includes("Dropshipping") && !storeName.trim()) {
      addToast("Store Name is required for Dropshipping upgrade.", "warning");
      return;
    }

    // Enforce the same per-tier mandatory document/field rules the admin approval flow already relies on
    const kycCheck = validateCustomerKycRequirements({
      customerTypes: requestedTypes,
      company,
      storeName,
      gstin,
      kycDocuments: kycDocs,
    });
    if (!kycCheck.isValid) {
      addToast(kycCheck.errorMessage || "Please complete all mandatory fields and KYC documents.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await customerService.submitUpgradeRequest({
        requestedTypes,
        company,
        storeName: requestedTypes.includes("Dropshipping") ? storeName : undefined,
        address,
        city,
        state,
        pinCode,
        phone,
        gstin,
        kycDocuments: kycDocs,
      });
      setActiveCustomer(updated);
      addToast("Upgrade request submitted successfully! Your account is under review.", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to submit upgrade request", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-muted-foreground">Loading customer details...</div>;
  }

  const isPending = activeCustomer?.upgradeStatus === "pending";
  const isApproved = activeCustomer?.customerTypes?.includes("B2B") && activeCustomer?.customerTypes?.includes("Dropshipping");
  const isRejected = activeCustomer?.upgradeStatus === "rejected";

  return (
    <div className="space-y-6 text-foreground max-w-4xl">
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upgrade Account to B2B / Dropshipping</h1>
          <p className="text-muted-foreground text-sm">Submit your business profile and KYC documents for verification.</p>
        </div>
      </div>

      {/* Pending status alert */}
      {isPending && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Clock className="h-8 w-8 text-amber-500 flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">Upgrade Request Under Review</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your request to upgrade to <strong>{activeCustomer.upgradeRequestedTypes?.join(" & ")}</strong> is currently being reviewed by our verification team. We will approve your account within 24 hours.
              </p>
              <p className="text-xs font-semibold text-muted-foreground pt-1">
                Need help? Contact support at <a href="mailto:support@flexsellwholesale.com" className="text-primary underline">support@flexsellwholesale.com</a> or call +91-9203675004.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rejected status alert */}
      {isRejected && !isPending && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <XCircle className="h-8 w-8 text-destructive flex-shrink-0" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-destructive">Previous Upgrade Request Rejected</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeCustomer?.upgradeRejectionReason
                  ? <>Reason: <strong>{activeCustomer.upgradeRejectionReason}</strong></>
                  : "Your request did not meet our verification requirements. Please review your details and resubmit below."}
              </p>
              <p className="text-xs font-semibold text-muted-foreground pt-1">
                You can update your details and documents below and resubmit your application at any time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fully approved notification */}
      {isApproved && (
        <Card className="border-green-500/30 bg-green-500/10">
          <CardContent className="p-6 flex items-center gap-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 flex-shrink-0" />
            <div>
              <h3 className="text-base font-bold text-green-600 dark:text-green-400">Fully Verified Wholesale Partner</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your account is fully approved for both B2B Wholesale and Dropshipping pricing tiers!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade Form */}
      {!isPending && !isApproved && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Upgrade Type */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-extrabold">1</span>
                Select Desired Tier(s)
              </CardTitle>
              <CardDescription>Select one or both wholesale tiers to apply for.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${requestedTypes.includes("B2B") ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary/20"
                  }`}>
                  <input
                    type="checkbox"
                    className="mt-1 rounded text-primary focus:ring-primary"
                    checked={requestedTypes.includes("B2B")}
                    onChange={(e) => {
                      if (e.target.checked) setRequestedTypes(prev => [...prev, "B2B"]);
                      else setRequestedTypes(prev => prev.filter(t => t !== "B2B"));
                    }}
                  />
                  <div>
                    <h4 className="text-sm font-bold">B2B Wholesale Portal</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Access tiered bulk discounts, MOQs, tax invoices, and credit terms.</p>
                  </div>
                </label>

                <label className={`p-4 border rounded-xl flex items-start gap-3 cursor-pointer transition-all ${requestedTypes.includes("Dropshipping") ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-secondary/20"
                  }`}>
                  <input
                    type="checkbox"
                    className="mt-1 rounded text-primary focus:ring-primary"
                    checked={requestedTypes.includes("Dropshipping")}
                    onChange={(e) => {
                      if (e.target.checked) setRequestedTypes(prev => [...prev, "Dropshipping"]);
                      else setRequestedTypes(prev => prev.filter(t => t !== "Dropshipping"));
                    }}
                  />
                  <div>
                    <h4 className="text-sm font-bold">Dropshipping Account</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">Direct customer delivery with white-label packaging and order sync.</p>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Business Profile */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-extrabold">2</span>
                Business & Contact Profile
              </CardTitle>
              <CardDescription>Enter your official business information.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    Company / Business Name {requestedTypes.includes("B2B") ? "*" : "(Optional)"}
                  </label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} required={requestedTypes.includes("B2B")} placeholder="e.g. Acme Enterprises" className="text-sm font-semibold" />
                </div>

                {requestedTypes.includes("Dropshipping") && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Store Name (Dropshipping) *</label>
                    <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} required placeholder="e.g. TrendyStore Online" className="text-sm font-semibold" />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">
                    GSTIN {requestedTypes.includes("Dropshipping") ? "*" : "(Optional)"}
                  </label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} required={requestedTypes.includes("Dropshipping")} placeholder="23AAACF1001M1Z5" className="text-sm font-mono font-bold" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Contact Phone *</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="10-digit mobile number" className="text-sm font-semibold" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Registered Business Address *</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Shop/Office No., Street, Area" className="text-sm font-semibold" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">City *</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required className="text-sm font-semibold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">State *</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Pin Code *</label>
                  <Input value={pinCode} onChange={(e) => setPinCode(e.target.value)} required className="text-sm font-mono font-bold" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Document Uploads */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-extrabold">3</span>
                KYC Verification Documents
              </CardTitle>
              <CardDescription>
                {requestedTypes.includes("Dropshipping")
                  ? "Aadhar Card, PAN Card, and GST Certificate are mandatory for Dropshipping accounts. Other files are optional."
                  : "Aadhar Card and PAN Card are mandatory for B2B Wholesale accounts. Other files are optional."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {DOCUMENT_SLOTS.map((slot) => {
                  const fileUrl = kycDocs[slot.key];
                  const isUploading = uploadingSlot === slot.key;
                  const isMandatory =
                    slot.key === "aadharCard" ||
                    slot.key === "panCard" ||
                    (requestedTypes.includes("Dropshipping") && slot.key === "gstCertificate");

                  return (
                    <div key={slot.key} className="border border-border rounded-lg p-3 bg-card space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-foreground">
                            {slot.label.replace(" (Optional)", "")} {isMandatory ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(Optional)</span>}
                          </span>
                          {fileUrl && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        </div>

                        {fileUrl ? (
                          <div className="mt-2 relative rounded border p-2 bg-secondary/20 flex items-center justify-between">
                            <div className="flex items-center gap-2 truncate">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-xs font-semibold truncate text-muted-foreground">
                                {fileUrl.startsWith("data:") ? "Uploaded file" : fileUrl.split("/").pop()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setKycDocs(prev => ({ ...prev, [slot.key]: undefined }))}
                              className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                              title="Remove document"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground mt-1">PDF, JPG, PNG (Max 1MB)</p>
                        )}
                      </div>

                      <div className="pt-2">
                        <label className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border transition-colors cursor-pointer ${fileUrl
                          ? "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"
                          : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                          } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
                          <Upload className="h-3.5 w-3.5" />
                          <span>{isUploading ? "Uploading..." : fileUrl ? "Replace File" : "Upload File"}</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(slot.key, f);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" size="lg" className="font-bold text-base px-8" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting Application..." : "Submit Upgrade Application"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
