"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eye, EyeOff, ShieldCheck, Truck, Sparkles, Building2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { motion } from "framer-motion";

import { OtpVerificationModal } from "@/components/auth/OtpVerificationModal";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [company, setCompany] = React.useState("");
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

  // OTP Modal State
  const [isOtpModalOpen, setIsOtpModalOpen] = React.useState(false);

  const { error, clearError, checkSession } = useAuthStore();
  const { addToast } = useToastStore();

  React.useEffect(() => {
    clearError();
  }, []);

  const sendOtpRequest = async (): Promise<boolean> => {
    const fullName = `${firstName} ${lastName}`.trim();
    const isRetail = customerTypes[0] === "B2C";
    const payload = {
      name: fullName,
      email,
      password,
      company: isRetail ? "" : company,
      address: skipAddress ? "" : address,
      city: skipAddress ? "" : city,
      state: skipAddress ? "" : state,
      pinCode: skipAddress ? "" : pinCode,
      phone,
      gstin: isRetail ? "" : gstin,
      skipAddress,
      customerTypes,
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

  const handleOtpVerified = async (data: any) => {
    setIsOtpModalOpen(false);
    addToast("Email verified! Wholesale account created successfully.", "success");
    await checkSession();
    router.push("/client");
    router.refresh();
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
    if (selectedType === "Dropshipping") return "Join white-label direct delivery partner network from Surat.";
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
              <span>Express Surat Cargo Shipping</span>
            </div>
          </div>
        </div>

        {/* Right Registration Form */}
        <div className="md:col-span-8 p-6 sm:p-8 space-y-6">
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
                      { type: "Dropshipping", label: "Dropshipper Partner", desc: "White-label direct delivery to your retail customers from Surat." },
                      { type: "B2C", label: "Retail Consumer", desc: "Standard individual utility items & personal order sourcing." }
                    ].map((item) => {
                      const isSelected = customerTypes.includes(item.type as any);
                      return (
                        <div
                          key={item.type}
                          onClick={() => setCustomerTypes([item.type as any])}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/40 bg-background"
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
                    <label className="font-bold">Company / Shop Name {selectedType === "B2B" ? "*" : "(Optional)"}</label>
                    <Input placeholder="Doe Enterprises" value={company} onChange={(e) => setCompany(e.target.value)} required={selectedType === "B2B"} disabled={isSubmitting} className="text-xs" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold">GSTIN (Optional)</label>
                    <Input placeholder="24AAACD4521D1Z1" value={gstin} onChange={(e) => setGstin(e.target.value)} disabled={isSubmitting} className="text-xs" />
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
                    <Input placeholder="Surat" value={city} onChange={(e) => setCity(e.target.value)} required={!skipAddress} disabled={isSubmitting} className="text-xs" />
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

          <div className="text-center text-xs border-t pt-4">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </div>
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
