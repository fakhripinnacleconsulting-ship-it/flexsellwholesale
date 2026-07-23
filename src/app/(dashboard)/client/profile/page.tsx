"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { customerService } from "@/services/customerService";
import { Customer } from "@/types";
import { useToastStore } from "@/stores/toastStore";
import { NotificationPreferencesCard } from "@/components/common/NotificationPreferencesCard";

const INDIAN_STATES = [
  "Madhya Pradesh", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Union Territory"
];

export default function ClientProfilePage() {
  const { addToast } = useToastStore();
  const [activeCustomer, setActiveCustomer] = React.useState<Customer | null>(null);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");

  const [company, setCompany] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");
  const [customerTypes, setCustomerTypes] = React.useState<("B2C" | "B2B" | "Dropshipping")[]>(["B2C"]);

  const [isSubmittingPersonal, setIsSubmittingPersonal] = React.useState(false);
  const [isSubmittingBusiness, setIsSubmittingBusiness] = React.useState(false);

  React.useEffect(() => {
    customerService.getActiveCustomer().then((cust) => {
      setActiveCustomer(cust);
      setFirstName(cust.name?.split(" ")[0] || "");
      setLastName(cust.name?.split(" ").slice(1).join(" ") || "");
      setEmail(cust.email || "");
      setPhone(cust.phone || "");
      setCompany(cust.company || "");
      setGstin(cust.gstin || "");
      setAddress(cust.address || "");
      setCity(cust.city || "");
      setState(cust.state || INDIAN_STATES[0]);
      setPinCode(cust.pinCode || "");
      setCustomerTypes(cust.customerTypes || ["B2C"]);
    }).catch(console.error);
  }, []);

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPersonal(true);
    try {
      const updated = await customerService.updateActiveCustomer({
        name: `${firstName} ${lastName}`.trim(),
        email,
        phone
      });
      setActiveCustomer(updated);
      addToast("Personal profile updated successfully!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to update personal details", "error");
    } finally {
      setIsSubmittingPersonal(false);
    }
  };

  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBusiness(true);
    try {
      const updated = await customerService.updateActiveCustomer({
        company,
        gstin,
        address,
        city,
        state,
        pinCode,
        customerTypes
      });
      setActiveCustomer(updated);
      addToast("Business information updated successfully!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to update business profile", "error");
    } finally {
      setIsSubmittingBusiness(false);
    }
  };

  if (!activeCustomer) {
    return <div className="text-center py-10 text-muted-foreground">Loading profile...</div>;
  }

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your personal and business details.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Details */}
        <div className="space-y-8">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Personal Information</CardTitle>
              <CardDescription>Update your basic profile details.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePersonal} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">First Name</label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="text-sm font-semibold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">Last Name</label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="text-sm font-semibold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Email Address</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="text-sm font-semibold" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Phone Number</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="text-sm font-semibold" />
                </div>
                <Button type="submit" className="font-bold" disabled={isSubmittingPersonal}>
                  {isSubmittingPersonal ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Business details */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Business Information</CardTitle>
            <CardDescription>B2B credentials and billing address details.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">Company Name</label>
                  <Input value={company} onChange={(e) => setCompany(e.target.value)} className="text-sm font-semibold" placeholder="Your Business Name" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-muted-foreground">GSTIN</label>
                  <Input value={gstin} onChange={(e) => setGstin(e.target.value)} className="text-sm font-mono font-bold" placeholder="Optional" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Billing Address *</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="text-sm font-semibold" placeholder="Street Address" />
              </div>

              <div className="grid grid-cols-3 gap-4">
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

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Customer Type *</label>
                <div className="flex gap-4 items-center pt-1">
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

              <Button type="submit" className="font-bold" disabled={isSubmittingBusiness}>
                {isSubmittingBusiness ? "Saving..." : "Update Business Profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Notification & Push Preferences Card */}
        <div className="lg:col-span-2">
          <NotificationPreferencesCard userId={activeCustomer?._id || "current"} role="customer" />
        </div>
      </div>
    </div>
  );
}
