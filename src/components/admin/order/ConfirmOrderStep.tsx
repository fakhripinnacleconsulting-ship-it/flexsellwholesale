"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Invoice } from "@/types";
import { formatPrice } from "@/lib/utils";

interface ConfirmOrderStepProps {
  quote: Invoice;
  onConfirmOrder: (payload: {
    quoteId: string;
    salesperson?: string;
    paymentOption: "now" | "later";
    paymentMethod?: "Bank Transfer" | "Razorpay" | "UPI" | "COD";
    transactionId?: string;
    shippingAddress?: any;
  }) => Promise<void>;
  onBack: () => void;
}

export function ConfirmOrderStep({ quote, onConfirmOrder, onBack }: ConfirmOrderStepProps) {
  const [salesperson, setSalesperson] = React.useState(quote.salesperson || "");
  const [paymentOption, setPaymentOption] = React.useState<"now" | "later">("now");
  const [paymentMethod, setPaymentMethod] = React.useState<"Bank Transfer" | "Razorpay" | "UPI" | "COD">("Bank Transfer");
  const [transactionId, setTransactionId] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Shipping Address States
  const [firstName, setFirstName] = React.useState(quote.shippingAddress?.firstName || "");
  const [lastName, setLastName] = React.useState(quote.shippingAddress?.lastName || "");
  const [email, setEmail] = React.useState(quote.customerEmail || quote.shippingAddress?.email || "");
  const [address, setAddress] = React.useState(quote.shippingAddress?.address || "");
  const [city, setCity] = React.useState(quote.shippingAddress?.city || "");
  const [state, setState] = React.useState(quote.shippingAddress?.state || "");
  const [pinCode, setPinCode] = React.useState(quote.shippingAddress?.pinCode || "");
  const [phone, setPhone] = React.useState(quote.shippingAddress?.phone || "");
  const [company, setCompany] = React.useState(quote.shippingAddress?.company || "");
  const [gstin, setGstin] = React.useState(quote.shippingAddress?.gstin || "");

  const [showAddressEditor, setShowAddressEditor] = React.useState(false);

  const isInitialAddressInvalid = React.useMemo(() => {
    const addr = quote.shippingAddress;
    if (!addr) return true;
    if (!addr.firstName || addr.firstName.trim().length < 1) return true;
    if (!addr.lastName || addr.lastName.trim().length < 1) return true;
    if (!addr.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) return true;
    if (!addr.address || addr.address.trim().length < 5) return true;
    if (!addr.city || addr.city.trim().length < 2) return true;
    if (!addr.state || addr.state.trim().length < 2) return true;
    if (!addr.pinCode || !/^\d{6}$/.test(addr.pinCode)) return true;
    if (!addr.phone || addr.phone.trim().length < 10) return true;
    return false;
  }, [quote]);

  React.useEffect(() => {
    if (isInitialAddressInvalid) {
      setShowAddressEditor(true);
    }
  }, [isInitialAddressInvalid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentOption === "now" && !transactionId.trim()) {
      alert("Please provide a transaction reference ID for Paid Invoices.");
      return;
    }

    if (showAddressEditor) {
      if (!firstName.trim()) { alert("First name is required."); return; }
      if (!lastName.trim()) { alert("Last name is required."); return; }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Invalid email address."); return; }
      if (address.trim().length < 5) { alert("Address must be at least 5 characters."); return; }
      if (city.trim().length < 2) { alert("City is required."); return; }
      if (state.trim().length < 2) { alert("State is required."); return; }
      if (!/^\d{6}$/.test(pinCode)) { alert("Pin code must be exactly 6 digits."); return; }
      if (phone.trim().length < 10) { alert("Phone number must be at least 10 digits."); return; }
    }

    setIsSubmitting(true);
    try {
      await onConfirmOrder({
        quoteId: quote._id,
        salesperson: salesperson.trim() || undefined,
        paymentOption,
        paymentMethod: paymentOption === "now" ? paymentMethod : undefined,
        transactionId: paymentOption === "now" ? transactionId.trim() : undefined,
        shippingAddress: showAddressEditor ? {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          pinCode: pinCode.trim(),
          phone: phone.trim(),
          company: company.trim() || undefined,
          gstin: gstin.trim() || undefined,
        } : undefined
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Cost Breakdown */}
      <div className="space-y-4">
        {showAddressEditor ? (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-lg space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h4 className="font-bold text-xs text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
                ⚠️ Correct Shipping Credentials
              </h4>
              {!isInitialAddressInvalid && (
                <button
                  type="button"
                  onClick={() => setShowAddressEditor(false)}
                  className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Cancel Edit
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">First Name *</label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Last Name *</label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Email *</label>
                <Input value={email} type="email" onChange={e => setEmail(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Phone Number *</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Company</label>
                <Input value={company} onChange={e => setCompany(e.target.value)} className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">GSTIN</label>
                <Input value={gstin} onChange={e => setGstin(e.target.value)} className="text-xs h-8" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Address *</label>
                <Input value={address} onChange={e => setAddress(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">City *</label>
                <Input value={city} onChange={e => setCity(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">State *</label>
                <Input value={state} onChange={e => setState(e.target.value)} required className="text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Pin Code (6 digits) *</label>
                <Input value={pinCode} onChange={e => setPinCode(e.target.value)} required className="text-xs h-8" />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-secondary/15 p-4 rounded-lg border grid grid-cols-1 md:grid-cols-2 gap-4 text-xs relative">
            <button
              type="button"
              onClick={() => setShowAddressEditor(true)}
              className="absolute right-3 top-3 text-xs text-primary hover:text-primary-hover font-semibold underline cursor-pointer"
            >
              Edit Shipping Address
            </button>
            <div>
              <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest border-b pb-1 mb-2">
                Buyer Profile
              </h4>
              <p className="font-bold text-sm text-foreground">{quote.customerName}</p>
              {quote.shippingAddress?.company && (
                <p className="text-muted-foreground mt-0.5">🏢 {quote.shippingAddress.company}</p>
              )}
              <p className="text-muted-foreground mt-0.5">✉️ {quote.customerEmail}</p>
              <p className="text-muted-foreground">📞 {quote.shippingAddress?.phone}</p>
              {quote.customerGstin && (
                <p className="text-emerald-600 dark:text-emerald-400 font-mono mt-1 font-bold">
                  GSTIN: {quote.customerGstin}
                </p>
              )}
            </div>
            <div>
              <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest border-b pb-1 mb-2">
                Shipping Credentials
              </h4>
              <p className="text-muted-foreground">{quote.shippingAddress?.address}</p>
              <p className="text-muted-foreground">
                {quote.shippingAddress?.city}, {quote.shippingAddress?.state} - {quote.shippingAddress?.pinCode}
              </p>
              <p className="text-primary font-bold mt-2">
                Link Source ID: <span className="font-mono text-xs">{quote._id}</span>
              </p>
            </div>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-secondary/25 border-b font-bold">
              <tr>
                <th className="p-3">Wholesale Variant</th>
                <th className="p-3 text-center">Unit Price</th>
                <th className="p-3 text-center">Quantity</th>
                <th className="p-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {quote.items.map((item: any) => (
                <tr key={item.id}>
                  <td className="p-3">
                    <p className="font-semibold text-foreground">{item.product.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {Object.entries(item.selectedVariants)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" | ")}
                    </p>
                  </td>
                  <td className="p-3 text-center">{formatPrice(item.pricePerUnit)}</td>
                  <td className="p-3 text-center font-semibold">{item.quantity}</td>
                  <td className="p-3 text-right font-bold">{formatPrice(item.pricePerUnit * item.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing computations */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-sm">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Taxable Value: {formatPrice(quote.taxDetails.baseSubtotal)}</p>
            {quote.taxDetails.isIntrastate ? (
              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                CGST: {formatPrice(quote.taxDetails.cgst)} | SGST: {formatPrice(quote.taxDetails.sgst)}
              </p>
            ) : (
              <p className="text-blue-600 dark:text-blue-400 font-medium">
                IGST: {formatPrice(quote.taxDetails.igst)}
              </p>
            )}
          </div>
          <div className="mt-3 md:mt-0 text-right">
            <span className="text-xs text-muted-foreground block">Authorized Grand Total</span>
            <span className="text-2xl font-black text-primary">{formatPrice(quote.amount)}</span>
          </div>
        </div>

        {/* Billing Setup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Confirm Salesperson</label>
            <Input
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              placeholder="e.g. Vikram Singh"
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Confirm Payment Terms</label>
            <select
              value={paymentOption}
              onChange={(e) => setPaymentOption(e.target.value as any)}
              className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md font-bold cursor-pointer h-10"
            >
              <option value="now">Pay Now (Generate Paid Invoice)</option>
              <option value="later">Pay Later (Generate Pending Receipt)</option>
            </select>
          </div>
        </div>

        {paymentOption === "now" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-lg border">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Razorpay">Online (Razorpay)</option>
                <option value="COD">Cash on Delivery (COD)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Transaction Ref / Reference ID *
              </label>
              <Input
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UPI109847382"
                required
                className="text-sm font-mono"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center border-t pt-4">
        <Button variant="outline" type="button" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button type="submit" disabled={isSubmitting} className="font-bold bg-primary text-primary-foreground">
          {isSubmitting ? "Converting Quote..." : "Convert Quote & Confirm Order"}
        </Button>
      </div>
    </form>
  );
}
