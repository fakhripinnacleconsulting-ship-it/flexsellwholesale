"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { Plus, Trash2, Edit2, CheckCircle2, Home, MapPin, Building, Phone } from "lucide-react";
import { SavedAddress } from "@/types";
import { customerService } from "@/services/customerService";

const INDIAN_STATES = [
  "Madhya Pradesh",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Union Territory"
];

export default function ClientAddressesPage() {
  const { addToast } = useToastStore();
  const [addresses, setAddresses] = React.useState<SavedAddress[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [apartment, setApartment] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);

  const fetchAddresses = async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getSavedAddresses();
      setAddresses(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load addresses", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAddresses();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setFirstName("");
    setLastName("");
    setCompany("");
    setAddress("");
    setApartment("");
    setCity("");
    setState(INDIAN_STATES[0]);
    setPinCode("");
    setPhone("");
    setGstin("");
    setIsDefault(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (addr: SavedAddress) => {
    setEditingId(addr._id);
    setName(addr.name);
    setFirstName(addr.firstName);
    setLastName(addr.lastName);
    setCompany(addr.company || "");
    setAddress(addr.address);
    setApartment(addr.apartment || "");
    setCity(addr.city);
    setState(addr.state || INDIAN_STATES[0]);
    setPinCode(addr.pinCode);
    setPhone(addr.phone);
    setGstin(addr.gstin || "");
    setIsDefault(addr.isDefault);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !firstName || !lastName || !address || !city || !state || !pinCode || !phone) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name,
        firstName,
        lastName,
        company,
        address,
        apartment,
        city,
        state,
        pinCode,
        phone,
        gstin,
        isDefault
      };

      let updatedList;
      if (editingId) {
        updatedList = await customerService.updateSavedAddress({ _id: editingId, ...payload });
      } else {
        updatedList = await customerService.addSavedAddress(payload);
      }

      setAddresses(updatedList);
      setIsModalOpen(false);
      resetForm();
      addToast(editingId ? "Address updated successfully!" : "Address added successfully!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save address", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this address?")) return;
    try {
      const updatedList = await customerService.deleteSavedAddress(id);
      setAddresses(updatedList);
      addToast("Address deleted successfully!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to delete address", "error");
    }
  };

  const handleSetDefault = async (addr: SavedAddress) => {
    try {
      const updatedList = await customerService.updateSavedAddress({ ...addr, isDefault: true });
      setAddresses(updatedList);
      addToast("Default address updated!", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to set default address", "error");
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saved Addresses</h1>
          <p className="text-muted-foreground mt-1">Manage billing, shipping, and cargo dispatch addresses.</p>
        </div>
        <Button onClick={handleOpenAddModal} className="font-bold flex items-center gap-1.5 shadow">
          <Plus className="h-4.5 w-4.5" /> Add New Address
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading your addresses...</div>
      ) : addresses.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="pt-10 pb-10 text-center">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-bold">No saved addresses</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-6">
              You haven't saved any B2B shipping addresses yet. Add one to speed up checkout.
            </p>
            <Button onClick={handleOpenAddModal}>Add First Address</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {addresses.map((addr) => (
            <Card key={addr._id} className={`border relative ${addr.isDefault ? "border-primary/50 shadow-md bg-primary/[0.02]" : "border-border shadow-sm"}`}>
              {addr.isDefault && (
                <div className="absolute top-3 right-3 bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Default
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-1.5 uppercase tracking-wide">
                  <Home className="h-4.5 w-4.5 text-muted-foreground" /> {addr.name}
                </CardTitle>
                <CardDescription className="font-bold text-foreground mt-1">
                  {addr.firstName} {addr.lastName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="space-y-1 text-muted-foreground">
                  {addr.company && (
                    <p className="font-semibold text-foreground flex items-center gap-1">
                      <Building className="h-3 w-3" /> {addr.company}
                    </p>
                  )}
                  <p>{addr.address}</p>
                  {addr.apartment && <p>{addr.apartment}</p>}
                  <p>{addr.city}, {addr.state} - <span className="font-mono">{addr.pinCode}</span></p>
                  <p className="flex items-center gap-1 mt-1 font-semibold text-foreground">
                    <Phone className="h-3 w-3 text-muted-foreground" /> {addr.phone}
                  </p>
                  {addr.gstin && (
                    <p className="font-mono font-bold text-primary mt-1">GSTIN: {addr.gstin}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t mt-4">
                  <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => handleOpenEditModal(addr)}>
                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 flex-1 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => handleDelete(addr._id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                  {!addr.isDefault && (
                    <Button variant="ghost" size="sm" className="h-8 text-primary font-bold hover:underline px-2" onClick={() => handleSetDefault(addr)}>
                      Set Default
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{editingId ? "Edit Saved Address" : "Add New Saved Address"}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Please provide exact B2B shipping credentials.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Address Label Name *</label>
                <Input placeholder="e.g. Surat Main Office, Indore Warehouse" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">First Name *</label>
                  <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Last Name *</label>
                  <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Company Name</label>
                  <Input placeholder="Company Name (optional)" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">GSTIN</label>
                  <Input placeholder="GSTIN (optional)" value={gstin} onChange={(e) => setGstin(e.target.value)} className="font-mono" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Street Address *</label>
                <Input placeholder="Street Address, Building, Shop No." value={address} onChange={(e) => setAddress(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Apartment, suite, unit etc.</label>
                <Input placeholder="Apartment, unit number (optional)" value={apartment} onChange={(e) => setApartment(e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-4">
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

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Phone Number *</label>
                <Input placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="default-check" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer" />
                <label htmlFor="default-check" className="font-semibold cursor-pointer">Set as default shipping address</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Address"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
