"use client";

import * as React from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { customerService } from "@/services/customerService";
import { Customer } from "@/types";
import { validateCustomerKycRequirements } from "@/lib/kycValidationHelper";

import { INDIAN_STATES } from "@/lib/constants";

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingCustomer: Customer | null;
}

export function CustomerFormModal({ isOpen, onClose, onSuccess, editingCustomer }: CustomerFormModalProps) {
  const { addToast } = useToastStore();
  const [isFormSubmitting, setIsFormSubmitting] = React.useState(false);
  const [uploadingDocSlot, setUploadingDocSlot] = React.useState<string | null>(null);

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [storeName, setStoreName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [customerTypes, setCustomerTypes] = React.useState<string[]>(["B2C"]);
  const [kycDocs, setKycDocs] = React.useState<import("@/types").KycDocuments>({});

  React.useEffect(() => {
    if (isOpen) {
      if (editingCustomer) {
        setName(editingCustomer.name || "");
        setEmail(editingCustomer.email || "");
        setPassword("");
        setCompany(editingCustomer.company || "");
        setStoreName(editingCustomer.storeName || "");
        setAddress(editingCustomer.address || "");
        setCity(editingCustomer.city || "");
        setState(editingCustomer.state || INDIAN_STATES[0]);
        setPinCode(editingCustomer.pinCode || "");
        setPhone(editingCustomer.phone || "");
        setGstin(editingCustomer.gstin || "");
        setCustomerTypes(editingCustomer.customerTypes || ["B2C"]);
        setKycDocs(editingCustomer.kycDocuments || {});
      } else {
        setName("");
        setEmail("");
        setPassword("");
        setCompany("");
        setStoreName("");
        setAddress("");
        setCity("");
        setState(INDIAN_STATES[0]);
        setPinCode("");
        setPhone("");
        setGstin("");
        setCustomerTypes(["B2C"]);
        setKycDocs({});
      }
    }
  }, [isOpen, editingCustomer]);

  const handleDocUpload = async (slotKey: keyof import("@/types").KycDocuments, file: File) => {
    if (file.size > 1024 * 1024) {
      addToast("File size exceeds 1 MB limit", "error");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      addToast("Invalid file type. Only PDF, JPG, JPEG, and PNG are allowed.", "error");
      return;
    }
    setUploadingDocSlot(slotKey);
    try {
      const res = await customerService.uploadDocument(file);
      setKycDocs(prev => ({ ...prev, [slotKey]: res.url }));
      addToast("Document uploaded", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Upload failed", "error");
    } finally {
      setUploadingDocSlot(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !address || !city || !state || !pinCode || !phone) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    if (!editingCustomer && !password) {
      addToast("Password is required for new customer accounts", "warning");
      return;
    }

    const kycCheck = validateCustomerKycRequirements({
      customerTypes,
      company,
      storeName: customerTypes.includes("Dropshipping") ? storeName : undefined,
      gstin,
      kycDocuments: kycDocs,
    });

    if (!kycCheck.isValid) {
      addToast(kycCheck.errorMessage || "Mandatory KYC verification documents or business details missing.", "error");
      return;
    }

    setIsFormSubmitting(true);
    try {
      const payload = {
        name,
        email: email.toLowerCase().trim(),
        password: password || undefined,
        company,
        storeName: customerTypes.includes("Dropshipping") ? storeName : undefined,
        address,
        city,
        state,
        pinCode,
        phone,
        gstin,
        customerTypes,
        kycDocuments: kycDocs
      };

      if (editingCustomer) {
        await customerService.updateCustomer(editingCustomer._id, payload);
      } else {
        await customerService.createCustomer(payload);
      }

      addToast(editingCustomer ? "Customer updated successfully!" : "Customer created successfully!", "success");
      onSuccess();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save customer", "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border rounded-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">{editingCustomer ? "Edit Customer Account" : "Create Customer Account"}</h3>
          <p className="text-muted-foreground text-xs mt-0.5">Define login credentials and business billing address details.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Name *</label>
              <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Email *</label>
              <Input placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Password {editingCustomer && "(Leave empty to keep current)"} *</label>
              <Input placeholder="Account Password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingCustomer} type="password" />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Phone *</label>
              <Input placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground flex items-center justify-between">
                <span>Company Name</span>
                {customerTypes.includes("B2B") && <span className="text-destructive text-[10px] uppercase font-bold">* Required for B2B</span>}
              </label>
              <Input placeholder="Company Name" value={company} onChange={(e) => setCompany(e.target.value)} required={customerTypes.includes("B2B")} />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground flex items-center justify-between">
                <span>GSTIN</span>
                {customerTypes.includes("Dropshipping") && <span className="text-destructive text-[10px] uppercase font-bold">* Required for Dropship</span>}
              </label>
              <Input placeholder="Buyer GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} required={customerTypes.includes("Dropshipping")} className="font-mono" />
            </div>
          </div>

          {customerTypes.includes("Dropshipping") && (
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Store Name (Dropshipping) *</label>
              <Input placeholder="Online Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} required />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground">Customer Type *</label>
            <div className="flex flex-wrap gap-3 items-center pt-1">
              {(["B2C", "B2B", "Dropshipping"] as const).map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded text-primary focus:ring-primary bg-background border-border"
                    checked={customerTypes.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCustomerTypes(prev => [...prev, type]);
                      } else {
                        if (customerTypes.length > 1) {
                          setCustomerTypes(prev => prev.filter(t => t !== type));
                        } else {
                          addToast("At least one customer type is required.", "warning");
                        }
                      }
                    }}
                  />
                  <span>{type}</span>
                </label>
              ))}
            </div>
          </div>

          {(customerTypes.includes("B2B") || customerTypes.includes("Dropshipping")) && (
            <div className="pt-1">
              {validateCustomerKycRequirements({ customerTypes, company, storeName, gstin, kycDocuments: kycDocs }).isValid ? (
                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                  <span>KYC Verification Status: All Mandatory Documents & Fields Complete</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-start gap-2 animate-pulse">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <span>
                    {customerTypes.includes("Dropshipping")
                      ? "Action Required for Dropshipping: Store Name, GSTIN, Aadhar Card, PAN Card, and GST Certificate are MANDATORY."
                      : "Action Required for B2B: Company Name, Aadhar Card, and PAN Card are MANDATORY."}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <label className="font-bold text-muted-foreground block">KYC Verification Documents (Max 1MB each, PDF/JPG/PNG)</label>
              {(customerTypes.includes("B2B") || customerTypes.includes("Dropshipping")) && (
                <span className="text-destructive font-bold text-[10px] uppercase">* Mandatory files marked below</span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: "aadharCard", label: "Aadhar Card *" },
                { key: "panCard", label: "PAN Card *" },
                { key: "gstCertificate", label: customerTypes.includes("Dropshipping") ? "GST Cert *" : "GST Cert (Optional)" },
                { key: "signaturePhoto", label: "Signature (Optional)" },
                { key: "passportPhoto", label: "Passport (Optional)" },
                { key: "chequePhoto", label: "Cheque (Optional)" },
              ].map((doc) => {
                const url = kycDocs[doc.key as keyof import("@/types").KycDocuments];
                const isUp = uploadingDocSlot === doc.key;
                return (
                  <div key={doc.key} className="border p-2 rounded bg-secondary/10 flex flex-col justify-between">
                    <span className="text-[10px] font-bold truncate">{doc.label}</span>
                    {url ? (
                      <div className="text-[9px] text-green-600 dark:text-green-400 font-bold truncate mt-1">Uploaded</div>
                    ) : (
                      <span className="text-[9px] text-muted-foreground italic">Empty</span>
                    )}
                    <label className="mt-1 cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold py-1 px-1.5 rounded text-center block">
                      {isUp ? "Uploading..." : url ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleDocUpload(doc.key as keyof import("@/types").KycDocuments, f);
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground">Billing Address *</label>
            <Input placeholder="Street Address, Corporate Building" value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">City *</label>
              <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">State *</label>
              <select value={state} onChange={(e) => setState(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-muted-foreground">Pin Code *</label>
              <Input placeholder="Pin Code" value={pinCode} onChange={(e) => setPinCode(e.target.value)} required className="font-mono" />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" disabled={isFormSubmitting} className="w-full sm:w-auto">
              {isFormSubmitting ? "Saving..." : "Save Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
