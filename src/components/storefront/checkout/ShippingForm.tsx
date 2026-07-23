import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

interface ShippingFormProps {
  currentUser: any;
  customersList: any[];
  selectedCustomerId: string;
  handleSelectDelegatedCustomer: (val: string) => void;
  savedAddresses: any[];
  handleSelectSavedAddress: (val: string) => void;
  email: string; setEmail: (val: string) => void;
  firstName: string; setFirstName: (val: string) => void;
  lastName: string; setLastName: (val: string) => void;
  company: string; setCompany: (val: string) => void;
  gstin: string; setGstin: (val: string) => void;
  address: string; setAddress: (val: string) => void;
  apartment: string; setApartment: (val: string) => void;
  city: string; setCity: (val: string) => void;
  state: string; handleStateChange: (val: string) => void;
  pinCode: string; setPinCode: (val: string) => void;
  phone: string; setPhone: (val: string) => void;
  INDIAN_STATES: string[];
}

export function ShippingForm({
  currentUser,
  customersList,
  selectedCustomerId,
  handleSelectDelegatedCustomer,
  savedAddresses,
  handleSelectSavedAddress,
  email, setEmail,
  firstName, setFirstName,
  lastName, setLastName,
  company, setCompany,
  gstin, setGstin,
  address, setAddress,
  apartment, setApartment,
  city, setCity,
  state, handleStateChange,
  pinCode, setPinCode,
  phone, setPhone,
  INDIAN_STATES
}: ShippingFormProps) {
  return (
    <>
      {currentUser?.role === "admin" && (
        <Card className="border-primary/50 border bg-primary/5">
          <CardHeader>
            <CardTitle className="text-primary text-base">
              Placing Order on Behalf of Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="text-sm font-semibold text-foreground block">
              Select B2B Customer <span className="text-destructive">*</span>
            </label>
            <select
              className="h-10 px-3 rounded-md border border-border bg-background text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary w-full cursor-pointer"
              value={selectedCustomerId}
              onChange={(e) => handleSelectDelegatedCustomer(e.target.value)}
              required
            >
              <option value="">-- Choose Customer --</option>
              {customersList.map((cust) => (
                <option key={cust._id} value={cust._id}>
                  {cust.name} ({cust._id}) - {cust.email}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Selecting a customer will automatically load their registered company address and calculate the corresponding state/IGST tax rates.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Email or mobile phone number"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="offers" className="rounded text-primary focus:ring-primary bg-background border-border" />
            <label htmlFor="offers" className="text-sm text-muted-foreground cursor-pointer">Email me with wholesale news and offers</label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {savedAddresses.length > 0 && (
            <div className="space-y-1.5 pb-2 border-b">
              <label className="text-xs font-bold uppercase text-muted-foreground">Quick Select Saved Address</label>
              <select
                onChange={(e) => handleSelectSavedAddress(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Choose a Saved Address --</option>
                {savedAddresses.map(addr => (
                  <option key={addr._id} value={addr._id}>
                    {addr.name} ({addr.firstName} {addr.lastName} - {addr.city}, {addr.state})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              placeholder="Company Name (optional)"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Input
              placeholder="GSTIN (optional)"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
          </div>
          <Input
            placeholder="Street Address, Shop No."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
          <Input
            placeholder="Apartment, suite, unit, etc. (optional)"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <select
              className="h-10 px-3 rounded-md border border-border bg-background text-sm font-semibold text-foreground focus:ring-2 focus:ring-primary w-full"
              value={state}
              onChange={(e) => handleStateChange(e.target.value)}
            >
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
            <Input
              placeholder="PIN Code"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              required
            />
          </div>
          <Input
            placeholder="Contact Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </CardContent>
      </Card>
    </>
  );
}
