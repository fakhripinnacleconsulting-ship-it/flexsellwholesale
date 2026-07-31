"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eye, EyeOff, ShieldCheck, Truck, Sparkles, Building2, Upload, CheckCircle2, Clock, FileText, X, PhoneCall, Mail } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { customerService } from "@/services/customerService";
import { KycDocuments } from "@/types";
import { motion } from "framer-motion";

import { OtpVerificationModal } from "@/components/auth/OtpVerificationModal";
import { trackSignUp } from "@/lib/gtm";

interface DocSlot {
  key: keyof KycDocuments;
  label: string;
  required: boolean;
}

const DOCUMENT_SLOTS: { key: keyof KycDocuments; label: string }[] = [
  { key: "aadharCard", label: "Aadhar Card" },
  { key: "panCard", label: "PAN Card" },
  { key: "gstCertificate", label: "GST Certificate" },
  { key: "signaturePhoto", label: "Signature Photo" },
  { key: "passportPhoto", label: "Passport Photo" },
  { key: "chequePhoto", label: "Cancelled Cheque" },
];

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [storeName, setStoreName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [pinCode, setPinCode] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [skipAddress, setSkipAddress] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [customerTypes, setCustomerTypes] = React.useState<("B2C" | "B2B" | "Dropshipping")[]>(["B2C"]);

  const [kycDocs, setKycDocs] = React.useState<KycDocuments>({});
  const [uploadingSlot, setUploadingSlot] = React.useState<string | null>(null);
  const [isPendingConfirmation, setIsPendingConfirmation] = React.useState(false);

  // OTP Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = React.useState(false);

  const { error, clearError, checkSession, loginWithGoogle } = useAuthStore();
  const { addToast } = useToastStore();

  React.useEffect(() => {
    clearError();

    // Pre-select the requested tab when arriving via a deep link like /register?type=b2b
    const requestedType = searchParams.get("type")?.toLowerCase();
    if (requestedType === "b2b") {
      setCustomerTypes(["B2B"]);
    } else if (requestedType === "dropshipping") {
      setCustomerTypes(["Dropshipping"]);
    }

    const initGoogleGsi = () => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "327707227008-017vqk7dtsdl5c5pbqcokf0a1752lqc3.apps.googleusercontent.com",
            callback: handleGoogleResponse,
          });

          const container = document.getElementById("google-signup-btn");
          if (container) {
            container.innerHTML = "";
            (window as any).google.accounts.id.renderButton(container, {
              theme: "outline",
              size: "large",
              width: 400,
              text: "signup_with",
              shape: "rectangular",
              logo_alignment: "left",
            });
          }
        } catch (err) {
          console.error("Failed to initialize Google Sign-Up:", err);
        }
      }
    };

    if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
      initGoogleGsi();
    } else {
      const existingScript = document.getElementById("google-gsi-script");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "google-gsi-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initGoogleGsi;
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener("load", initGoogleGsi);
      }
    }
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response || !response.credential) {
      addToast("Google Sign-In credential missing", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const success = await loginWithGoogle(response.credential);
      if (success) {
        addToast("Registered via Google successfully!", "success");
        const currentCustomer = useAuthStore.getState().customer;
        const redirectDest = currentCustomer?.role === "admin" ? "/admin" : "/client";
        router.push(redirectDest);
        router.refresh();
      } else {
        addToast("Google Sign-In failed", "error");
      }
    } catch (err: unknown) {
      addToast((err as any).message || "Google Sign-In failed", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (slotKey: keyof KycDocuments, file: File) => {
    if (file.size > 1024 * 1024) {
      addToast("File size exceeds 1 MB limit", "error");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.type)) {
      addToast("Invalid file type. Only PDF, JPG, JPEG, and PNG files are allowed.", "error");
      return;
    }
    setUploadingSlot(slotKey);
    try {
      const res = await customerService.uploadDocument(file);
      setKycDocs(prev => ({ ...prev, [slotKey]: res.url }));
      addToast("Document uploaded successfully", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Document upload failed", "error");
    } finally {
      setUploadingSlot(null);
    }
  };

  const sendOtpRequest = async (): Promise<boolean> => {
    const fullName = `${firstName} ${lastName}`.trim();
    const isRetail = customerTypes[0] === "B2C";
    const payload = {
      name: fullName,
      email,
      password,
      company: isRetail ? "" : company,
      storeName: customerTypes.includes("Dropshipping") ? storeName : undefined,
      address: skipAddress ? "" : address,
      city: skipAddress ? "" : city,
      state: skipAddress ? "" : state,
      pinCode: skipAddress ? "" : pinCode,
      phone,
      gstin: isRetail ? "" : gstin,
      skipAddress,
      customerTypes,
      kycDocuments: isRetail ? undefined : kycDocs,
    };

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to send verification code");
      }

      addToast(data.message || "Verification code sent to your email", "info");
      return true;
    } catch (err: any) {
      addToast(err.message || "Failed to send OTP code", "error");
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName || !lastName || !email || !phone || !password) {
      addToast("Please fill in all required personal credentials", "warning");
      return;
    }

    const isRetail = customerTypes[0] === "B2C";

    if (!isRetail) {
      const { validateCustomerKycRequirements } = require("@/lib/kycValidationHelper");
      const kycCheck = validateCustomerKycRequirements({
        customerTypes,
        company,
        storeName,
        gstin,
        kycDocuments: kycDocs,
      });

      if (!kycCheck.isValid) {
        addToast(kycCheck.errorMessage || "Please complete required business fields and upload mandatory KYC documents.", "error");
        return;
      }
    }

    if (!skipAddress && (!address || !city || !state || !pinCode)) {
      addToast("Please fill in your delivery address or click 'Add Address Later' to skip", "warning");
      return;
    }

    setIsSubmitting(true);
    const sent = await sendOtpRequest();
    setIsSubmitting(false);

    if (sent) {
      setIsOtpModalOpen(true);
    }
  };

  const handleOtpVerified = async () => {
    setIsOtpModalOpen(false);
    await checkSession();
    const isRetail = customerTypes[0] === "B2C";
    trackSignUp(selectedType);
    if (isRetail) {
      addToast("Account created successfully!", "success");
      router.push("/client");
      router.refresh();
    } else {
      setIsPendingConfirmation(true);
    }
  };

  const selectedType = customerTypes[0] || "B2C";

  const getButtonLabel = () => {
    if (isSubmitting) return "Creating Account...";
    if (selectedType === "B2B") return "Create B2B Account";
    if (selectedType === "Dropshipping") return "Create Dropshipper Account";
    return "Create Retail Account";
  };

  const getHeaderTitle = () => {
    if (selectedType === "B2B") return "Create Wholesale Account";
    if (selectedType === "Dropshipping") return "Create Dropshipper Account";
    return "Create Retail Account";
  };

  const getHeaderSubtitle = () => {
    if (selectedType === "B2B") return "Register your business to unlock factory pricing and bulk order specs.";
    if (selectedType === "Dropshipping") return "Join white-label direct delivery partner network from Bhopal.";
    return "Sign up for individual order tracking and personal shopping convenience.";
  };

  const getConsentText = () => {
    if (selectedType === "B2B" || selectedType === "Dropshipping") {
      return "I confirm I am registering a legitimate business or reseller account.";
    }
    return "I confirm I am registering a personal retail customer account.";
  };

  const getSection2Header = () => {
    if (selectedType === "B2B" || selectedType === "Dropshipping") {
      return "2. Business Details & Shipping Address";
    }
    return "2. Delivery Address";
  };

  return (
    <div className="container mx-auto px-4 py-12 flex justify-center items-center text-foreground min-h-[80vh]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-12 rounded-2xl overflow-hidden border border-border shadow-xl bg-card"
      >
        {/* Left Branding Panel */}
        <div className="md:col-span-4 bg-gradient-to-br from-primary via-emerald-600 to-emerald-700 p-8 text-primary-foreground flex flex-col justify-between hidden md:flex">
          <div className="space-y-4">
            <span className="inline-block bg-white/20 backdrop-blur text-white text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              {selectedType === "B2C" ? "Retail Account" : selectedType === "Dropshipping" ? "Dropshipper Portal" : "Wholesale Registration"}
            </span>
            <h2 className="text-2xl font-black leading-tight">
              {selectedType === "B2C" ? "Shop Quality Direct Factory Collection" : selectedType === "Dropshipping" ? "White-Label Direct Fulfillment" : "Access Direct Manufacturer Wholesale Rates"}
            </h2>
            <p className="text-xs text-white/90 leading-relaxed">
              {selectedType === "B2C" ? "Fast dispatch, buyer protection, and best rates on factory quality goods." : "Join 2,000+ Indian retailers and dropshipper partners accessing factory prices and low MOQs."}
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/20 text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{selectedType === "B2C" ? "Secure Checkout & Instant Invoice" : "Instant B2B GST Tax Invoicing"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{selectedType === "B2C" ? "Verified Quality Catalog" : "Bulk Order Pricing Tiers"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0" />
              <span>Express Bhopal Order Shipping</span>
            </div>
          </div>
        </div>

        {/* Right Registration Form */}
        <div className="md:col-span-8 p-6 sm:p-8 space-y-6">
          {isPendingConfirmation ? (
            <div className="py-8 space-y-6 text-center">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto animate-bounce-slow">
                <Clock className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black tracking-tight text-foreground">Application Under Review</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Thank you for registering as a <strong>{selectedType}</strong> partner! Your business details and KYC verification documents have been submitted to our team.
                </p>
                <div className="p-4 bg-secondary/30 rounded-xl border max-w-md mx-auto text-left space-y-2 text-xs">
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-500" /> Review Timeline: Within 24 Hours
                  </p>
                  <p className="text-muted-foreground">
                    Our onboarding specialists will review your documents and activate your wholesale pricing access shortly.
                  </p>
                  <div className="pt-2 border-t space-y-1">
                    <p className="font-bold text-foreground">Need Urgent Assistance?</p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 text-primary" /> support@flexsellwholesale.com
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <PhoneCall className="h-3.5 w-3.5 text-primary" /> +91-9203675004
                    </p>
                  </div>
                </div>
              </div>
              <Button onClick={() => router.push("/client")} size="lg" className="font-bold">
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <h1 className="text-2xl font-black tracking-tight">{getHeaderTitle()}</h1>
                <p className="text-xs text-muted-foreground">
                  {getHeaderSubtitle()}
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md border border-destructive/20 text-center font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6 text-xs">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">1. Personal & Login Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold">First Name *</label>
                      <Input placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={isSubmitting} className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold">Last Name *</label>
                      <Input placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={isSubmitting} className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold">Email Address *</label>
                      <Input type="email" placeholder="john@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} className="text-xs" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold">Phone Number *</label>
                      <Input type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={isSubmitting} className="text-xs" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="font-bold">Password *</label>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="Create password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isSubmitting} className="pr-10 text-xs" />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                          tabIndex={-1}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="font-bold">Select Business Account Model *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        {[
                          { type: "B2B", label: "Wholesale Buyer (B2B)", desc: "Bulk factory sourcing with GST tax invoice credits & tier discounts." },
                          { type: "Dropshipping", label: "Dropshipper Partner", desc: "White-label direct delivery to your retail customers from Bhopal." },
                          { type: "B2C", label: "Retail Consumer", desc: "Standard individual utility items & personal order sourcing." }
                        ].map((item) => {
                          const isSelected = customerTypes.includes(item.type as any);
                          return (
                            <div
                              key={item.type}
                              onClick={() => setCustomerTypes([item.type as any])}
                              className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/40 bg-background"
                                }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground">{item.label}</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-1 leading-normal">{item.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary">{getSection2Header()}</h3>
                    <button
                      type="button"
                      onClick={() => setSkipAddress(!skipAddress)}
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-md transition-colors"
                    >
                      {skipAddress ? "＋ Add Delivery Address Now" : "⏱ Add Address Later"}
                    </button>
                  </div>

                  {selectedType !== "B2C" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-1">
                      <div className="space-y-1">
                        <label className="font-bold">
                          Company / Shop Name {selectedType === "B2B" ? "*" : "(Optional)"}
                        </label>
                        <Input placeholder="Acme Enterprises" value={company} onChange={(e) => setCompany(e.target.value)} required={selectedType === "B2B"} disabled={isSubmitting} className="text-xs" />
                      </div>
                      {selectedType === "Dropshipping" && (
                        <div className="space-y-1">
                          <label className="font-bold">Store Name (Dropshipping) *</label>
                          <Input placeholder="TrendyStore Online" value={storeName} onChange={(e) => setStoreName(e.target.value)} required disabled={isSubmitting} className="text-xs" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="font-bold">
                          GSTIN {selectedType === "Dropshipping" ? "*" : "(Optional)"}
                        </label>
                        <Input placeholder="24AAACD4521D1Z1" value={gstin} onChange={(e) => setGstin(e.target.value)} required={selectedType === "Dropshipping"} disabled={isSubmitting} className="text-xs font-mono" />
                      </div>
                    </div>
                  )}

                  {/* KYC Verification Uploads for B2B & Dropshipping */}
                  {selectedType !== "B2C" && (
                    <div className="border-t pt-4 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">3. KYC Document Verification</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {selectedType === "Dropshipping"
                          ? "Aadhar Card, PAN Card, and GST Certificate are mandatory for Dropshipping accounts. Other files are optional."
                          : "Aadhar Card and PAN Card are mandatory for B2B Wholesale accounts. Other files are optional."}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {DOCUMENT_SLOTS.map((slot) => {
                          const url = kycDocs[slot.key];
                          const isUp = uploadingSlot === slot.key;
                          const isMandatory =
                            slot.key === "aadharCard" ||
                            slot.key === "panCard" ||
                            (selectedType === "Dropshipping" && slot.key === "gstCertificate");

                          return (
                            <div key={slot.key} className="border p-2.5 rounded-lg bg-secondary/10 flex flex-col justify-between space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-bold">
                                  {slot.label} {isMandatory ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(Opt)</span>}
                                </span>
                                {url && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                              </div>
                              <label className="cursor-pointer bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold py-1 px-2 rounded text-center block transition-colors">
                                {isUp ? "Uploading..." : url ? "Replace File" : "Upload File"}
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
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {skipAddress ? (
                    <div className="p-3.5 bg-muted/40 rounded-xl border border-dashed text-xs text-muted-foreground text-center">
                      🚚 Delivery address skipped for now. You can add your delivery address anytime from your Customer Dashboard or at Checkout.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1 md:col-span-2">
                        <label className="font-bold">Street Address *</label>
                        <Input placeholder="45 Textile Market, Ring Road" value={address} onChange={(e) => setAddress(e.target.value)} required={!skipAddress} disabled={isSubmitting} className="text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold">City *</label>
                        <Input placeholder="Bhopal" value={city} onChange={(e) => setCity(e.target.value)} required={!skipAddress} disabled={isSubmitting} className="text-xs" />
                      </div>
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="font-bold">State *</label>
                            <Input placeholder="Gujarat" value={state} onChange={(e) => setState(e.target.value)} required={!skipAddress} disabled={isSubmitting} className="text-xs" />
                          </div>
                          <div>
                            <label className="font-bold">Pin Code *</label>
                            <Input placeholder="395002" value={pinCode} onChange={(e) => setPinCode(e.target.value)} required={!skipAddress} disabled={isSubmitting} className="text-xs" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <input type="checkbox" id="terms" className="mt-0.5 rounded text-primary focus:ring-primary" required disabled={isSubmitting} />
                  <label htmlFor="terms" className="text-[11px] text-muted-foreground">
                    I agree to the <Link href="/policies/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/policies/privacy" className="text-primary hover:underline">Privacy Policy</Link>. {getConsentText()}
                  </label>
                </div>

                <Button type="submit" className="w-full font-bold" disabled={isSubmitting}>
                  {getButtonLabel()}
                </Button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink mx-4 text-muted-foreground text-[10px] uppercase font-bold">Or register with</span>
                <div className="flex-grow border-t border-border"></div>
              </div>

              <div id="google-signup-btn" className="w-full min-h-[40px] flex justify-center items-center"></div>

              <div className="text-center text-xs border-t pt-4">
                Already have an account?{" "}
                <Link href="/login" className="text-primary font-bold hover:underline">
                  Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>

      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={email}
        onSuccess={handleOtpVerified}
        onCancel={() => setIsOtpModalOpen(false)}
        onResendOtp={sendOtpRequest}
      />
    </div>
  );
}
