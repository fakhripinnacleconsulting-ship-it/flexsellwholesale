"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Building, Save, Loader2 } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { apiClient, handleApiError } from "@/lib/apiClient";

export interface CompanyInfoData {
  storeName: string;
  legalName?: string;
  gstin: string;
  pan?: string;
  cin?: string;
  companyAddress: string;
  city?: string;
  state?: string;
  pinCode?: string;
  supportEmail: string;
  supportPhone: string;
  websiteUrl?: string;
  timings?: string;
  signatureUrl: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
  termsAndConditions: string[];
}

interface CompanyInformationTabProps {
  companyInfo: CompanyInfoData;
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfoData>>;
}

export function CompanyInformationTab({ companyInfo, setCompanyInfo }: CompanyInformationTabProps) {
  const { addToast } = useToastStore();
  const [isSavingCompanyInfo, setIsSavingCompanyInfo] = React.useState(false);

  const handleSaveCompanyInfo = async () => {
    setIsSavingCompanyInfo(true);
    try {
      await apiClient.post("/cms", {
        key: "businessSettings",
        value: companyInfo,
      });
      addToast("Centralized Company & Brand Settings saved successfully!", "success");
    } catch (err: unknown) {
      addToast(handleApiError(err, "Failed to save settings"), "error");
    } finally {
      setIsSavingCompanyInfo(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const data = await apiClient.post<{ url?: string; message?: string }>("/upload", formData);
      if (data.url) {
        const signatureUrl = data.url;
        setCompanyInfo(prev => ({ ...prev, signatureUrl }));
        addToast("Digital signature uploaded successfully!", "success");
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err: unknown) {
      addToast(handleApiError(err, "Failed to upload signature"), "error");
    }
  };

  const handleAddTermLine = () => {
    setCompanyInfo(prev => ({
      ...prev,
      termsAndConditions: [...(prev.termsAndConditions || []), ""],
    }));
  };

  const handleRemoveTermLine = (index: number) => {
    setCompanyInfo(prev => ({
      ...prev,
      termsAndConditions: (prev.termsAndConditions || []).filter((_, i) => i !== index),
    }));
  };

  const handleUpdateTermLine = (index: number, text: string) => {
    setCompanyInfo(prev => ({
      ...prev,
      termsAndConditions: (prev.termsAndConditions || []).map((item, i) => (i === index ? text : item)),
    }));
  };

  return (
    <Card className="p-6 space-y-8 shadow-sm border-border/80">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" /> Centralized Company & Brand Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure all corporate profile details, GST, contact info, operational timings, digital signatures, bank payment details, and invoice terms in one single place.
          </p>
        </div>
        <Button onClick={handleSaveCompanyInfo} disabled={isSavingCompanyInfo} className="font-semibold gap-2 cursor-pointer bg-primary text-primary-foreground">
          {isSavingCompanyInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSavingCompanyInfo ? "Saving..." : "Save All Company Settings"}
        </Button>
      </div>

      {/* Grid Section 1: Business Profile & Corporate Information */}
      <div className="space-y-4">
        <h3 className="font-bold text-xs text-primary uppercase tracking-wider border-b pb-1">
          1. Corporate Profile & Legal Identification
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Store / Brand Name *</label>
            <Input
              value={companyInfo.storeName || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, storeName: e.target.value }))}
              placeholder="e.g. FlexSell Wholesale"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Legal Entity Name</label>
            <Input
              value={companyInfo.legalName || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, legalName: e.target.value }))}
              placeholder="e.g. FlexSell Wholesale Sourcing Pvt Ltd"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">GSTIN (GST Identification Number) *</label>
            <Input
              value={companyInfo.gstin || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))}
              placeholder="e.g. 24AAACF1001M1Z5"
              className="font-mono uppercase text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">PAN Number</label>
            <Input
              value={companyInfo.pan || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
              placeholder="e.g. AAACF1001M"
              className="font-mono uppercase text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Corporate Identity Number (CIN)</label>
            <Input
              value={companyInfo.cin || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, cin: e.target.value.toUpperCase() }))}
              placeholder="e.g. U51909MP2024PTC012345"
              className="font-mono uppercase text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Website Domain URL</label>
            <Input
              value={companyInfo.websiteUrl || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, websiteUrl: e.target.value }))}
              placeholder="e.g. https://flexsellwholesale.com"
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid Section 2: Contact, Address & Footer Timings */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-bold text-xs text-primary uppercase tracking-wider border-b pb-1">
          2. Contact Information, Address & Support Hours (Syncs with Footer)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Support Email *</label>
            <Input
              value={companyInfo.supportEmail || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, supportEmail: e.target.value }))}
              placeholder="e.g. support@flexsellwholesale.com"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Support Phone / Helpline *</label>
            <Input
              value={companyInfo.supportPhone || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, supportPhone: e.target.value }))}
              placeholder="e.g. +91 88877 66655"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Operational Support Hours</label>
            <Input
              value={companyInfo.timings || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, timings: e.target.value }))}
              placeholder="e.g. 9:30 AM to 6:30 PM (Sunday Closed)"
              className="text-xs"
            />
          </div>
          <div className="md:col-span-2">
            <label className="font-semibold block mb-1 text-muted-foreground">Registered Street Address *</label>
            <Input
              value={companyInfo.companyAddress || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, companyAddress: e.target.value }))}
              placeholder="e.g. Plot No. 12, GIDC Industrial Estate, Sachin"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">City</label>
            <Input
              value={companyInfo.city || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, city: e.target.value }))}
              placeholder="e.g. Bhopal"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">State</label>
            <Input
              value={companyInfo.state || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, state: e.target.value }))}
              placeholder="e.g. Madhya Pradesh"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Postal Pin Code</label>
            <Input
              value={companyInfo.pinCode || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, pinCode: e.target.value }))}
              placeholder="e.g. 394230"
              className="font-mono text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid Section 2: Authorized Signatory Signature Upload */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-bold text-xs text-primary uppercase tracking-wider border-b pb-1">
          2. Authorized Signatory Digital Signature
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload a digital signature or official stamp image. This signature image will be automatically attached to <strong>Authorized Signatory / For {companyInfo.storeName}</strong> on all printed PDF invoices, quotes, and receipts.
        </p>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-secondary/10 p-4 rounded-lg border">
          <div className="w-48 h-24 bg-white border border-dashed border-border rounded flex items-center justify-center overflow-hidden p-2 relative shadow-xs">
            {companyInfo.signatureUrl ? (
              <img src={companyInfo.signatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-center text-muted-foreground text-[11px]">
                No Signature Uploaded
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleSignatureUpload}
                className="text-xs max-w-xs cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Recommended size: 300x100px. Supports PNG (transparent background) or JPEG.
            </p>
            {companyInfo.signatureUrl && (
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={() => setCompanyInfo(prev => ({ ...prev, signatureUrl: "" }))}
                className="text-xs h-7 px-2 cursor-pointer"
              >
                Remove Signature
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Section 3: Bank Account Details for Wire Transfer */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-bold text-xs text-primary uppercase tracking-wider border-b pb-1">
          3. Bank Payment & Wire Transfer Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Bank Name</label>
            <Input
              value={companyInfo.bankName || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, bankName: e.target.value }))}
              placeholder="e.g. HDFC Bank"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Account Beneficiary Name</label>
            <Input
              value={companyInfo.accountName || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, accountName: e.target.value }))}
              placeholder="e.g. FlexSell Wholesale Sourcing Pvt Ltd"
              className="text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Account Number</label>
            <Input
              value={companyInfo.accountNumber || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, accountNumber: e.target.value }))}
              placeholder="e.g. 50200012345678"
              className="font-mono text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">IFSC Code</label>
            <Input
              value={companyInfo.ifscCode || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, ifscCode: e.target.value.toUpperCase() }))}
              placeholder="e.g. HDFC0001234"
              className="font-mono uppercase text-xs"
            />
          </div>
          <div>
            <label className="font-semibold block mb-1 text-muted-foreground">Branch Name</label>
            <Input
              value={companyInfo.branchName || ""}
              onChange={(e) => setCompanyInfo(prev => ({ ...prev, branchName: e.target.value }))}
              placeholder="e.g. Vijay Nagar, Indore Branch"
              className="text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid Section 4: Dynamic Terms & Conditions / Policies */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex justify-between items-center border-b pb-1">
          <h3 className="font-bold text-xs text-primary uppercase tracking-wider">
            4. Document Terms & Conditions / Policies
          </h3>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddTermLine}
            className="text-xs font-semibold gap-1 cursor-pointer"
          >
            + Add Term Line
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Customize the standard terms & policies displayed at the footer of generated B2B quotes, tax invoices, and payment receipts.
        </p>

        <div className="space-y-2">
          {companyInfo.termsAndConditions.map((term, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-muted-foreground w-6 text-right">
                {idx + 1}.
              </span>
              <Input
                value={term}
                onChange={(e) => handleUpdateTermLine(idx, e.target.value)}
                placeholder={`Term / Condition line ${idx + 1}...`}
                className="text-xs flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveTermLine(idx)}
                className="text-destructive hover:bg-destructive/10 h-8 px-2 text-xs cursor-pointer"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
