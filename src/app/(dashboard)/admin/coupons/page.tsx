"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToastStore } from "@/stores/toastStore";
import { Plus, Trash2, Edit2, Ticket, Percent, Check, X, Calendar, Search } from "lucide-react";
import { Coupon, Customer } from "@/types";
import { couponService } from "@/services/couponService";
import { customerService } from "@/services/customerService";
import { useConfirmStore } from "@/stores/confirmStore";

export default function AdminCouponsPage() {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const [coupons, setCoupons] = React.useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form states
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [discountType, setDiscountType] = React.useState<"flat" | "percentage">("percentage");
  const [discountValue, setDiscountValue] = React.useState("");
  const [minOrderValue, setMinOrderValue] = React.useState("");
  const [maxDiscount, setMaxDiscount] = React.useState("");
  const [expiryDate, setExpiryDate] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);

  // Personalized & limits states
  const [isPersonalized, setIsPersonalized] = React.useState(false);
  const [allowedCustomers, setAllowedCustomers] = React.useState<string[]>([]);
  const [usageLimit, setUsageLimit] = React.useState("");
  const [usageLimitPerCustomer, setUsageLimitPerCustomer] = React.useState("1");
  const [customersList, setCustomersList] = React.useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = React.useState("");

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearch.trim()) return customersList;
    return customersList.filter(
      (c) =>
        (c.name || "").toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.email || "").toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customersList, customerSearch]);

  const fetchCoupons = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await couponService.getCoupons();
      setCoupons(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load coupons", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const fetchCustomers = React.useCallback(async () => {
    try {
      const response = await customerService.getCustomers();
      const list = Array.isArray(response)
        ? response
        : (response && typeof response === "object" && Array.isArray((response as any).customers)
            ? (response as any).customers
            : []);
      setCustomersList(list);
    } catch (err) {
      console.error("Failed to load customers list:", err);
    }
  }, []);

  React.useEffect(() => {
    fetchCoupons();
    fetchCustomers();
  }, [fetchCoupons, fetchCustomers]);

  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setDiscountType("percentage");
    setDiscountValue("");
    setMinOrderValue("");
    setMaxDiscount("");
    setExpiryDate("");
    setIsActive(true);
    setIsPersonalized(false);
    setAllowedCustomers([]);
    setUsageLimit("");
    setUsageLimitPerCustomer("1");
    setCustomerSearch("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    fetchCustomers();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (coupon: Coupon) => {
    setEditingId(coupon._id);
    setCode(coupon.code);
    setDiscountType(coupon.discountType);
    setDiscountValue(String(coupon.discountValue));
    setMinOrderValue(String(coupon.minOrderValue || ""));
    setMaxDiscount(String(coupon.maxDiscount || ""));
    setExpiryDate(coupon.expiryDate);
    setIsActive(coupon.isActive);
    setIsPersonalized(coupon.isPersonalized || false);
    setAllowedCustomers(coupon.allowedCustomers || []);
    setUsageLimit(coupon.usageLimit ? String(coupon.usageLimit) : "");
    setUsageLimitPerCustomer(String(coupon.usageLimitPerCustomer ?? 1));
    setCustomerSearch("");
    fetchCustomers();
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !discountType || !discountValue || !expiryDate) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: code.toUpperCase().trim(),
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderValue: parseFloat(minOrderValue) || 0,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : undefined,
        expiryDate,
        isActive,
        isPersonalized,
        allowedCustomers,
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        usageLimitPerCustomer: parseInt(usageLimitPerCustomer, 10) || 1
      };

      if (editingId) {
        await couponService.updateCoupon(editingId, payload);
      } else {
        await couponService.createCoupon(payload);
      }

      setIsModalOpen(false);
      resetForm();
      addToast(editingId ? "Coupon updated successfully!" : "Coupon created successfully!", "success");
      fetchCoupons();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to save coupon", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    confirmAction({
      title: "Delete Coupon",
      message: "Are you sure you want to delete this coupon permanently? This action cannot be undone.",
      confirmText: "Yes, Delete",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await couponService.deleteCoupon(id);
          addToast("Coupon deleted successfully!", "success");
          fetchCoupons();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to delete coupon", "error");
        }
      }
    });
  };

  const handleToggleActive = (coupon: Coupon) => {
    const nextState = !coupon.isActive;
    confirmAction({
      title: `${nextState ? "Activate" : "Deactivate"} Coupon`,
      message: `Are you sure you want to ${nextState ? "activate" : "deactivate"} coupon "${coupon.code}"?`,
      confirmText: nextState ? "Activate" : "Deactivate",
      cancelText: "Cancel",
      type: nextState ? "info" : "warning",
      onConfirm: async () => {
        try {
          await couponService.updateCoupon(coupon._id, { isActive: nextState });
          addToast(`Coupon status updated!`, "success");
          fetchCoupons();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to update coupon status", "error");
        }
      }
    });
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Coupons</h1>
          <p className="text-muted-foreground mt-1">Configure discount codes, limits, and expiration.</p>
        </div>
        <Button onClick={handleOpenAddModal} className="font-bold flex items-center gap-1.5 shadow">
          <Plus className="h-4.5 w-4.5" /> Create Coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading coupons...</div>
      ) : coupons.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="pt-10 pb-10 text-center">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-bold">No coupons found</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-1 mb-6">
              Create discount coupons to incentivize bulk purchase deals.
            </p>
            <Button onClick={handleOpenAddModal}>Create Coupon</Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-secondary/30 border-b">
                  <tr>
                    <th className="px-6 py-3.5">Code</th>
                    <th className="px-6 py-3.5">Discount Value</th>
                    <th className="px-6 py-3.5">Target Scope</th>
                    <th className="px-6 py-3.5">Usage Stats</th>
                    <th className="px-6 py-3.5">Min Order value</th>
                    <th className="px-6 py-3.5">Expiry Date</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((coupon) => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const isExpired = coupon.expiryDate < todayStr;
                    return (
                       <tr key={coupon._id} className="hover:bg-secondary/15 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded text-xs">
                            {coupon.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-foreground">
                          {coupon.discountType === "flat" ? `₹${coupon.discountValue}` : `${coupon.discountValue}%`}
                          {coupon.maxDiscount && <span className="text-[10px] text-muted-foreground block font-normal">Max cap: ₹{coupon.maxDiscount}</span>}
                        </td>
                        <td className="px-6 py-4">
                          {coupon.isPersonalized ? (
                            <div className="space-y-0.5">
                              <span className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 rounded-full px-2 py-0.5 text-[10px] font-bold">
                                Personal ({coupon.allowedCustomers?.length || 0})
                              </span>
                              <span className="text-[9px] text-muted-foreground block truncate max-w-[120px]" title={coupon.allowedCustomers?.join(", ")}>
                                {coupon.allowedCustomers?.join(", ")}
                              </span>
                            </div>
                          ) : (
                            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full px-2 py-0.5 text-[10px] font-bold">
                              Public
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          <div className="space-y-0.5 text-xs">
                            <div>{coupon.usedCount || 0} / {coupon.usageLimit ?? "∞"}</div>
                            <span className="text-[9px] text-muted-foreground block font-normal">Limit: {coupon.usageLimitPerCustomer || 1}/user</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-semibold text-foreground">
                          ₹{coupon.minOrderValue}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-semibold flex items-center gap-1 mt-1.5 border-none">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className={isExpired ? "text-red-500 font-bold" : ""}>
                            {new Date(coupon.expiryDate).toLocaleDateString()} {isExpired && "(Expired)"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button onClick={() => handleToggleActive(coupon)} className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                            coupon.isActive && !isExpired
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500"
                          }`}>
                            {coupon.isActive && !isExpired ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <Button variant="outline" size="sm" className="h-8" onClick={() => handleOpenEditModal(coupon)}>
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => handleDelete(coupon._id)}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-foreground space-y-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">{editingId ? "Edit B2B Coupon" : "Create New B2B Coupon"}</h3>
              <p className="text-muted-foreground text-xs mt-0.5">Please provide configuration limits for the discount code.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Coupon Code *</label>
                <Input placeholder="e.g. B2B15, BULK500" value={code} onChange={(e) => setCode(e.target.value)} required className="font-mono uppercase" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Discount Type *</label>
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Discount Value *</label>
                  <Input placeholder="e.g. 15 or 500" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required type="number" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Min Order Value (₹)</label>
                  <Input placeholder="e.g. 5000" value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Max Discount Amount (₹)</label>
                  <Input placeholder="e.g. 2000 (optional)" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} type="number" disabled={discountType === "flat"} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground">Expiration Date *</label>
                <Input value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required type="date" />
              </div>

              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="coupon-personalized"
                  checked={isPersonalized}
                  onChange={(e) => setIsPersonalized(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer"
                />
                <label htmlFor="coupon-personalized" className="font-semibold cursor-pointer">Personalized (Restrict to specific customers)</label>
              </div>

              {isPersonalized && (
                <div className="space-y-2 border border-purple-500/20 bg-purple-500/5 p-3 rounded-lg animate-in fade-in slide-in-from-top-1 duration-150">
                  <label className="font-bold text-purple-700 dark:text-purple-400">Target Customers (Select one or more) *</label>
                  
                  {/* Selected customers as tags/pills */}
                  {allowedCustomers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {allowedCustomers.map((email) => {
                        const cust = customersList.find((c) => c.email === email);
                        const displayName = cust ? cust.name : email;
                        return (
                          <span
                            key={email}
                            className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-bold px-2 py-0.5 rounded text-[10px]"
                          >
                            {displayName}
                            <button
                              type="button"
                              onClick={() => setAllowedCustomers(allowedCustomers.filter((e) => e !== email))}
                              className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Search customers by name or email..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="pl-8 text-xs h-8 mb-2 bg-background"
                    />
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-32 overflow-y-auto border border-border bg-background rounded-md p-1 space-y-0.5">
                    {filteredCustomers.map((cust) => {
                      const isSelected = allowedCustomers.includes(cust.email);
                      return (
                        <button
                          type="button"
                          key={cust._id}
                          onClick={() => {
                            if (isSelected) {
                              setAllowedCustomers(allowedCustomers.filter((e) => e !== cust.email));
                            } else {
                              setAllowedCustomers([...allowedCustomers, cust.email]);
                            }
                          }}
                          className={`w-full text-left flex items-center justify-between p-1.5 rounded text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-purple-50 dark:bg-purple-950/20 text-purple-900 dark:text-purple-400 font-bold"
                              : "hover:bg-secondary/20 text-foreground"
                          }`}
                        >
                          <span>{cust.name} ({cust.email})</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />}
                        </button>
                      );
                    })}
                    {filteredCustomers.length === 0 && (
                      <div className="text-muted-foreground text-center py-4">No matching customers found.</div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Total Usage Limit (Optional)</label>
                  <Input
                    placeholder="e.g. 100 (leave blank for unlimited)"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    type="number"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-muted-foreground">Usage Limit Per Customer</label>
                  <Input
                    placeholder="e.g. 1"
                    value={usageLimitPerCustomer}
                    onChange={(e) => setUsageLimitPerCustomer(e.target.value)}
                    type="number"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="coupon-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border cursor-pointer" />
                <label htmlFor="coupon-active" className="font-semibold cursor-pointer">Activate Coupon Immediately</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
