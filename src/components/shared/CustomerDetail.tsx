"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Customer } from "@/types";
import { customerService } from "@/services/customerService";
import { useOrderStore } from "@/stores/orderStore";
import { formatPrice } from "@/lib/utils";
import { ArrowLeft, User, ShoppingBag, CreditCard, Mail, Phone, MapPin, Building, ShieldAlert, CheckCircle2, Truck, Clock, Store, FileText, ExternalLink, ArrowUpCircle, XCircle } from "lucide-react";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { StaffWalletPanel } from "@/components/wallet/StaffWalletPanel";

interface CustomerDetailProps {
  customerId: string;
}

export function CustomerDetail({ customerId }: CustomerDetailProps) {
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const router = useRouter();
  const pathname = usePathname();
  const basePath = pathname.startsWith("/manager") ? "/manager" : "/admin";
  const isAdminView = !pathname.startsWith("/manager");

  const { orders, initializeOrders } = useOrderStore();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const fetchCustomersData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getCustomers();
      const list = Array.isArray(data)
        ? data
        : (data && typeof data === "object" && Array.isArray((data as any).customers) ? (data as any).customers : []);
      setCustomers(list);
    } catch {
      addToast("Failed to load customer profiles", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchCustomersData();
    initializeOrders();
  }, [initializeOrders, fetchCustomersData]);

  const customer = React.useMemo(() => customers.find(c => c._id === customerId), [customers, customerId]);

  const handleApprove = () => {
    if (!customer) return;

    const requested = customer.upgradeRequestedTypes || [];
    const existing = customer.customerTypes || ["B2C"];
    const targetTypes = Array.from(new Set([...existing, ...requested])) as string[];

    const { validateCustomerKycRequirements } = require("@/lib/kycValidationHelper");
    const kycCheck = validateCustomerKycRequirements({
      customerTypes: targetTypes,
      company: customer.company,
      storeName: customer.storeName,
      gstin: customer.gstin,
      kycDocuments: customer.kycDocuments,
    });

    if (!kycCheck.isValid) {
      addToast(kycCheck.errorMessage || "Cannot approve upgrade: Customer missing required KYC documents or business details.", "error");
      return;
    }

    confirmAction({
      title: "Approve Wholesale Upgrade",
      message: `Are you sure you want to approve the upgrade application for "${customer.name}"? This will combine their requested account tiers and grant wholesale access.`,
      confirmText: "Approve Upgrade",
      type: "info",
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await customerService.approveUpgrade(customer._id);
          addToast("Customer upgrade approved!", "success");
          fetchCustomersData();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to approve upgrade", "error");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleReject = () => {
    if (!customer) return;
    confirmAction({
      title: "Reject Upgrade Request",
      message: `Are you sure you want to reject the upgrade request for "${customer.name}"? Their account status will revert to standard B2C.`,
      confirmText: "Reject Upgrade",
      type: "danger",
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          await customerService.rejectUpgrade(customer._id);
          addToast("Upgrade request rejected.", "info");
          fetchCustomersData();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to reject upgrade", "error");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const customerOrders = React.useMemo(() => {
    if (!customer) return [];
    return orders.filter(o => o.shippingAddress.email.toLowerCase() === customer.email.toLowerCase());
  }, [orders, customer]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-xl font-bold mb-2">Loading Customer Profile...</h2>
        <p className="text-muted-foreground">Retrieving B2B invoice and purchase histories.</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-3" />
        <h2 className="text-2xl font-bold mb-2">Customer Record Not Found</h2>
        <p className="text-muted-foreground mb-6">We couldn't locate any customer record matching ID "{customerId}".</p>
        <Button onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
      </div>
    );
  }

  // Stat computations
  const totalSpent = customerOrders.reduce((sum, o) => sum + o.amount, 0);
  const pendingOrders = customerOrders.filter(o => o.status === "Processing").length;
  const shippedOrders = customerOrders.filter(o => o.status === "Shipped").length;
  const deliveredOrders = customerOrders.filter(o => o.status === "Delivered").length;
  const kycDocs = customer.kycDocuments || {};
  /**
   * KYC applies to wholesale tiers only.
   */
  const WHOLESALE_TIERS = ["B2B", "Dropshipping"];
  const needsKyc =
    (customer.customerTypes || []).some((t) => WHOLESALE_TIERS.includes(t)) ||
    (customer.upgradeRequestedTypes || []).some((t) => WHOLESALE_TIERS.includes(t)) ||
    customer.upgradeStatus === "pending";

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-6xl">
      {/* Back Header */}
      <div>
        <Button onClick={() => router.back()} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 gap-4">
          <div className="flex items-center gap-3">
            <Avatar initials={customer.initials} className="h-12 w-12 text-lg bg-primary text-primary-foreground border" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
              <p className="text-xs text-muted-foreground">ID: {customer._id} | Company: {customer.company || "Individual"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Upgrade Alert Banner */}
      {customer.upgradeStatus === "pending" && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-7 w-7 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-600 dark:text-amber-400 text-sm">Upgrade Application Pending</h4>
                <p className="text-xs text-muted-foreground">
                  Requested Tiers: <strong>{customer.upgradeRequestedTypes?.join(", ")}</strong>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10 font-bold" onClick={handleReject} disabled={isProcessing}>
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={handleApprove} disabled={isProcessing}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-full">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Orders</p>
              <h4 className="text-lg font-black">{customerOrders.length}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-yellow-500/10 text-yellow-600 p-2 rounded-full">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Processing</p>
              <h4 className="text-lg font-black">{pendingOrders}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-purple-500/10 text-purple-600 p-2 rounded-full">
              <Truck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Shipped</p>
              <h4 className="text-lg font-black">{shippedOrders}</h4>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-green-500/10 text-green-600 p-2 rounded-full">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Revenue Spent</p>
              <h4 className="text-lg font-black text-primary">{formatPrice(totalSpent)}</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Side: Profile details */}
        <div className="space-y-6">
          <Card className="border border-border">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-primary" /> Profile Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email Address:</span>
                <p className="font-bold text-foreground pl-5">{customer.email}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone Number:</span>
                <p className="font-bold text-foreground pl-5">{customer.phone}</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Business Company:</span>
                <p className="font-bold text-foreground pl-5">{customer.company || "Individual / Direct"}</p>
              </div>
              {customer.storeName && (
                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Store className="h-3.5 w-3.5" /> Store Name (Dropship):</span>
                  <p className="font-bold text-foreground pl-5">{customer.storeName}</p>
                </div>
              )}
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><Building className="h-3.5 w-3.5" /> Customer Types:</span>
                <div className="pl-5 flex flex-wrap gap-1 mt-0.5">
                  {(customer.customerTypes || ["B2C"]).map(type => (
                    <span
                      key={type}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${type === "B2C" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : type === "B2B" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        }`}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
              {customer.gstin && (
                <div className="space-y-1">
                  <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> B2B GSTIN Code:</span>
                  <p className="font-mono font-bold text-primary pl-5">{customer.gstin}</p>
                </div>
              )}
              <div className="space-y-1 pt-2 border-t">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 animate-bounce-slow" /> Shipping Address:</span>
                <div className="pl-5 text-muted-foreground space-y-0.5">
                  <p className="font-bold text-foreground">{customer.name}</p>
                  <p>{customer.address}</p>
                  <p>{customer.city}, {customer.state} - {customer.pinCode}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KYC Documents Card — wholesale tiers only */}
          {needsKyc && (
            <Card className="border border-border">
              <CardHeader className="border-b pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-primary" /> KYC Verification Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {[
                  { key: "gstCertificate", label: "GST Certificate" },
                  { key: "signaturePhoto", label: "Signature Photo" },
                  { key: "aadharCard", label: "Aadhar Card" },
                  { key: "passportPhoto", label: "Passport Photo" },
                  { key: "panCard", label: "PAN Card" },
                  { key: "chequePhoto", label: "Cancelled Cheque" },
                ].map((doc) => {
                  const url = kycDocs[doc.key as keyof typeof kycDocs];
                  return (
                    <div key={doc.key} className="flex items-center justify-between p-2 rounded-md border text-xs bg-secondary/10">
                      <span className="font-bold text-foreground">{doc.label}</span>
                      {url ? (
                        <div className="flex items-center gap-2">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Not uploaded</span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side: wallets, then order history */}
        <div className="lg:col-span-2 space-y-6">
          <StaffWalletPanel
            userId={customerId}
            customerName={customer.name}
            isAdmin={isAdminView}
          />

          <Card className="border border-border">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-bold">Purchase Log</CardTitle>
              <CardDescription>All invoices and tracking history generated for this buyer.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/30 border-b">
                    <tr>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Invoice Date</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                          No purchases logged for this account.
                        </td>
                      </tr>
                    ) : (
                      customerOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-secondary/10 transition-colors">
                          <td className="px-4 py-3 font-bold">{order._id}</td>
                          <td className="px-4 py-3 text-muted-foreground">{order.date}</td>
                          <td className="px-4 py-3 text-right font-bold text-foreground">{formatPrice(order.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${order.statusClass}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`${basePath}/orders/${order._id}`}>
                              <Button variant="outline" size="sm" className="h-7 text-[10px]">
                                Manage
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
