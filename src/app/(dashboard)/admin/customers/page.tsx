"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Customer } from "@/types";
import { customerService } from "@/services/customerService";
import { useOrderStore } from "@/stores/orderStore";
import { useToastStore } from "@/stores/toastStore";
import { formatPrice } from "@/lib/utils";
import { Plus, Eye, Edit2, Trash2, Building } from "lucide-react";

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

export default function AdminCustomersPage() {
  const { addToast } = useToastStore();
  const { orders, initializeOrders } = useOrderStore();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);

  // Form input states
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState(INDIAN_STATES[0]);
  const [pinCode, setPinCode] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [customerTypes, setCustomerTypes] = React.useState<string[]>(["B2C"]);

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load customers", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    const loadData = async () => {
      try {
        await initializeOrders();
        await fetchCustomers();
      } catch (err) {
        console.error("Failed to load customers", err);
      }
    };
    loadData();
  }, [initializeOrders]);

  const resetForm = () => {
    setEditingCustomer(null);
    setName("");
    setEmail("");
    setPassword("");
    setCompany("");
    setAddress("");
    setCity("");
    setState(INDIAN_STATES[0]);
    setPinCode("");
    setPhone("");
    setGstin("");
    setCustomerTypes(["B2C"]);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setEmail(cust.email);
    setPassword(""); // Keep password empty unless changing
    setCompany(cust.company || "");
    setAddress(cust.address);
    setCity(cust.city);
    setState(cust.state || INDIAN_STATES[0]);
    setPinCode(cust.pinCode);
    setPhone(cust.phone);
    setGstin(cust.gstin || "");
    setCustomerTypes(cust.customerTypes || ["B2C"]);
    setIsModalOpen(true);
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

    setIsFormSubmitting(true);
    try {
      const payload = {
        name,
        email: email.toLowerCase().trim(),
        password: password || undefined,
        company,
        address,
        city,
        state,
        pinCode,
        phone,
        gstin,
        customerTypes
      };

      let res;
      if (editingCustomer) {
        res = await fetch("/api/customers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ _id: editingCustomer._id, ...payload })
        });
      } else {
        res = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to save customer");
      }

      addToast(editingCustomer ? "Customer updated successfully!" : "Customer created successfully!", "success");
      setIsModalOpen(false);
      resetForm();
      fetchCustomers();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save customer", "error");
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer account permanently?")) return;
    try {
      const res = await fetch(`/api/customers?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to delete customer");
      }
      addToast("Customer account deleted successfully", "success");
      fetchCustomers();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to delete customer", "error");
    }
  };

  // Compute stats for each customer dynamically
  const customerStats = React.useMemo(() => {
    return customers.map(cust => {
      const customerOrders = orders.filter(
        o => o.shippingAddress.email.toLowerCase() === cust.email.toLowerCase()
      );
      const totalSpend = customerOrders.reduce((sum, o) => sum + o.amount, 0);
      return {
        ...cust,
        ordersCount: customerOrders.length,
        totalSpend
      };
    });
  }, [orders, customers]);

  return (
    <div className="space-y-6 text-foreground container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wholesale Customers</h1>
          <p className="text-muted-foreground mt-1">Manage and view purchasing history of B2B wholesale buyers.</p>
        </div>
        <Button onClick={handleOpenAddModal} className="font-bold flex items-center gap-1.5 shadow">
          <Plus className="h-4.5 w-4.5" /> Create Buyer Account
        </Button>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-bold">Active Buyer Accounts</CardTitle>
          <CardDescription>Dynamic purchasing volume and GSTIN credentials.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-foreground">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b">
                <tr>
                  <th className="px-6 py-3.5">Customer Name</th>
                  <th className="px-6 py-3.5">Company Details</th>
                  <th className="px-6 py-3.5">Customer Type</th>
                  <th className="px-6 py-3.5 text-center">Total Orders</th>
                  <th className="px-6 py-3.5 text-right">Total Revenue</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      Loading B2B customers...
                    </td>
                  </tr>
                ) : customerStats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                      No customer accounts found.
                    </td>
                  </tr>
                ) : (
                  customerStats.map((cust) => (
                    <tr key={cust._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar initials={cust.initials} className="bg-primary text-primary-foreground border" />
                        <div>
                          <p className="font-bold text-foreground">{cust.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{cust.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground" /> {cust.company || "Individual"}
                        </p>
                        {cust.gstin && (
                          <p className="text-[10px] font-mono text-primary font-bold mt-0.5">GSTIN: {cust.gstin}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(cust.customerTypes || ["B2C"]).map(type => (
                            <span
                              key={type}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                type === "B2C" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : type === "B2B" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                              }`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">{cust.ordersCount} orders</td>
                      <td className="px-6 py-4 text-right font-black text-foreground">
                        {formatPrice(cust.totalSpend)}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <Link href={`/admin/customers/${cust._id}`}>
                          <Button variant="outline" size="sm" className="font-semibold">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm" className="font-semibold" onClick={() => handleOpenEditModal(cust)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => handleDeleteCustomer(cust._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{editingCustomer ? "Edit Customer Account" : "Create Customer Account"}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Define login credentials and business billing address details.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Name *</label>
                  <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Email *</label>
                  <Input placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} required type="email" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Password {editingCustomer && "(Leave empty to keep current)"} *</label>
                  <Input placeholder="Account Password" value={password} onChange={(e) => setPassword(e.target.value)} required={!editingCustomer} type="password" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Phone *</label>
                  <Input placeholder="Mobile Number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Company Name</label>
                  <Input placeholder="Company Name" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">GSTIN</label>
                  <Input placeholder="Buyer GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} className="font-mono" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Customer Type *</label>
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

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Billing Address *</label>
                <Input placeholder="Street Address, Corporate Building" value={address} onChange={(e) => setAddress(e.target.value)} required />
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

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isFormSubmitting}>
                  {isFormSubmitting ? "Saving..." : "Save Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
