"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomerFormModal } from "@/components/shared/CustomerFormModal";
import { Avatar } from "@/components/ui/Avatar";
import { Customer } from "@/types";
import { customerService } from "@/services/customerService";
import { useOrderStore } from "@/stores/orderStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { formatPrice } from "@/lib/utils";
import { Plus, Eye, Edit2, Trash2, Building, ShieldAlert, CheckCircle2, Search, Mail } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { validateCustomerKycRequirements, hasUploadedKycDoc } from "@/lib/kycValidationHelper";
import { useDraggableScroll } from "@/hooks/useDraggableScroll";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { apiClient } from "@/lib/apiClient";

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
  const { ref, onMouseDown, onMouseLeave, onMouseUp, onMouseMove, onDragStart } = useDraggableScroll<HTMLDivElement>();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const { orders, initializeOrders } = useOrderStore();
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filter states
  const [searchTerm, setSearchTerm] = React.useState("");
  const [kycStatusFilter, setKycStatusFilter] = React.useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = React.useState("");
  const [accountStatusFilter, setAccountStatusFilter] = React.useState("");
  const [dateJoinedFrom, setDateJoinedFrom] = React.useState("");
  const [dateJoinedTo, setDateJoinedTo] = React.useState("");

  // Pagination states
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(10);

  // Modal states
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = React.useState(false);
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null);

  // Bulk Mail states
  const [selectedCustomerEmails, setSelectedCustomerEmails] = React.useState<string[]>([]);
  const [isMailModalOpen, setIsMailModalOpen] = React.useState(false);
  const [mailSubject, setMailSubject] = React.useState("");
  const [mailContent, setMailContent] = React.useState("");
  const [isSendingMail, setIsSendingMail] = React.useState(false);

  const fetchCustomers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (err: any) {
      addToast(err.message || "Failed to fetch customers", "error");
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  React.useEffect(() => {
    fetchCustomers();
    initializeOrders();
  }, [fetchCustomers, initializeOrders]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setIsModalOpen(true);
  };

// Handlers for modal logic moved to CustomerFormModal

  const handleDeleteCustomer = (id: string) => {
    confirmAction({
      title: "Delete Customer?",
      message: "Are you sure you want to delete this customer? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
      onConfirm: async () => {
        try {
          await customerService.deleteCustomer(id);
          addToast("Customer deleted successfully", "success");
          fetchCustomers();
        } catch (err: unknown) {
          addToast((err as any).message || "Failed to delete customer", "error");
        }
      }
    });
  };

  const filteredCustomers = React.useMemo(() => {
    let result = customers;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        (c.company && c.company.toLowerCase().includes(term))
      );
    }

    if (customerTypeFilter) {
      result = result.filter(c => c.customerTypes && c.customerTypes.includes(customerTypeFilter as any));
    }

    if (accountStatusFilter) {
      if (accountStatusFilter === "Upgrade Pending") {
        result = result.filter(c => c.upgradeStatus === "pending");
      } else if (accountStatusFilter === "Active") {
        result = result.filter(c => c.upgradeStatus !== "pending");
      }
    }

    if (kycStatusFilter) {
      result = result.filter(c => {
        const kycCheck = validateCustomerKycRequirements({
          customerTypes: c.customerTypes || ["B2C"],
          company: c.company || "",
          storeName: c.storeName,
          gstin: c.gstin || "",
          kycDocuments: c.kycDocuments || {}
        });
        if (kycStatusFilter === "Valid") return kycCheck.isValid;
        if (kycStatusFilter === "Invalid") return !kycCheck.isValid;
        return true;
      });
    }

    if (dateJoinedFrom) {
      result = result.filter(c => c.createdAt && new Date(c.createdAt) >= new Date(dateJoinedFrom));
    }

    if (dateJoinedTo) {
      result = result.filter(c => c.createdAt && new Date(c.createdAt) <= new Date(dateJoinedTo));
    }

    return result;
  }, [customers, searchTerm, customerTypeFilter, accountStatusFilter, kycStatusFilter, dateJoinedFrom, dateJoinedTo]);

  // Compute stats for each customer dynamically
  const customerStats = React.useMemo(() => {
    return filteredCustomers.map(cust => {
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
  }, [orders, filteredCustomers]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, customerTypeFilter, accountStatusFilter, kycStatusFilter, dateJoinedFrom, dateJoinedTo, itemsPerPage]);

  const totalPages = Math.ceil(customerStats.length / itemsPerPage);

  const paginatedCustomers = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return customerStats.slice(start, start + itemsPerPage);
  }, [customerStats, currentPage, itemsPerPage]);

  const handleSendBulkMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomerEmails.length === 0) {
      addToast("No customers selected.", "warning");
      return;
    }
    if (!mailSubject.trim() || !mailContent.trim()) {
      addToast("Subject and content are required.", "warning");
      return;
    }

    setIsSendingMail(true);
    try {
      const data = await apiClient.post<any>("/admin/bulk-email", {
        emails: selectedCustomerEmails,
        subject: mailSubject,
        html: mailContent,
      });
      addToast(data.message || "Emails sent successfully!", "success");
      setIsMailModalOpen(false);
      setMailSubject("");
      setMailContent("");
      setSelectedCustomerEmails([]);
    } catch (err: any) {
      console.error(err);
      addToast(err.message || "Failed to send emails.", "error");
    } finally {
      setIsSendingMail(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allEmails = paginatedCustomers.map((c) => c.email).filter(Boolean);
      const uniqueEmails = Array.from(new Set([...selectedCustomerEmails, ...allEmails]));
      setSelectedCustomerEmails(uniqueEmails);
    } else {
      const visibleEmails = paginatedCustomers.map((c) => c.email).filter(Boolean);
      setSelectedCustomerEmails((prev) => prev.filter((email) => !visibleEmails.includes(email)));
    }
  };

  const handleSelectOne = (email: string, checked: boolean) => {
    if (!email) return;
    if (checked) {
      setSelectedCustomerEmails((prev) => [...prev, email]);
    } else {
      setSelectedCustomerEmails((prev) => prev.filter((e) => e !== email));
    }
  };

  const isAllVisibleSelected =
    paginatedCustomers.length > 0 &&
    paginatedCustomers.every((c) => c.email && selectedCustomerEmails.includes(c.email));

  return (
    <div className="space-y-6 text-foreground container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage B2B buyers and review KYC documents.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {selectedCustomerEmails.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsMailModalOpen(true)}
              className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 shadow"
            >
              <Mail className="h-4.5 w-4.5" />
              Send Mail ({selectedCustomerEmails.length})
            </Button>
          )}
          <Button onClick={handleOpenAddModal} className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 shadow">
            <Plus className="h-4.5 w-4.5" /> Create Buyer Account
          </Button>
        </div>
      </div>

      <Card className="border border-border">
        <CardHeader className="border-b pb-4 flex flex-col gap-4 bg-card rounded-t-xl">
          <div>
            <CardTitle className="text-lg font-bold">Active Buyer Accounts</CardTitle>
            <CardDescription>Dynamic purchasing volume and GSTIN credentials.</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full">
            <div className="relative flex-grow sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, company..."
                className="pl-9 text-foreground text-xs h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              value={customerTypeFilter}
              onChange={(e) => setCustomerTypeFilter(e.target.value)}
              className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
            >
              <option value="">All Types</option>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
              <option value="Dropshipping">Dropshipping</option>
            </select>

            <select
              value={kycStatusFilter}
              onChange={(e) => setKycStatusFilter(e.target.value)}
              className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
            >
              <option value="">All KYC Status</option>
              <option value="Valid">Valid KYC</option>
              <option value="Invalid">Invalid/Missing KYC</option>
            </select>

            <select
              value={accountStatusFilter}
              onChange={(e) => setAccountStatusFilter(e.target.value)}
              className="bg-background text-foreground text-xs font-semibold px-2.5 py-1.5 border rounded-md cursor-pointer h-9"
            >
              <option value="">All Account Status</option>
              <option value="Active">Active</option>
              <option value="Upgrade Pending">Upgrade Pending</option>
            </select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">Joined From:</span>
              <Input
                type="date"
                className="w-32 text-foreground h-9 px-2 py-1 text-xs"
                value={dateJoinedFrom}
                onChange={(e) => setDateJoinedFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium">To:</span>
              <Input
                type="date"
                className="w-32 text-foreground h-9 px-2 py-1 text-xs"
                value={dateJoinedTo}
                onChange={(e) => setDateJoinedTo(e.target.value)}
              />
            </div>

            {(searchTerm || customerTypeFilter || kycStatusFilter || accountStatusFilter || dateJoinedFrom || dateJoinedTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={() => {
                  setSearchTerm("");
                  setCustomerTypeFilter("");
                  setKycStatusFilter("");
                  setAccountStatusFilter("");
                  setDateJoinedFrom("");
                  setDateJoinedTo("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-col">
          <div
            className="overflow-x-auto overflow-y-auto h-[calc(100vh-280px)] min-h-[400px] custom-scrollbar cursor-grab active:cursor-grabbing select-none pb-0"
            ref={ref}
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            <table className="w-full text-sm text-left text-foreground whitespace-nowrap" onDragStart={onDragStart}>
              <thead className="text-xs text-muted-foreground uppercase bg-secondary border-b border-border sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded text-primary focus:ring-primary cursor-pointer"
                      checked={isAllVisibleSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-6 py-3.5">ID</th>
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
                    <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                      Loading B2B customers...
                    </td>
                  </tr>
                ) : customerStats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                      No customer accounts found.
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((cust) => (
                    <tr key={cust._id} className="hover:bg-secondary/15 transition-colors">
                      <td className="px-6 py-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded text-primary focus:ring-primary cursor-pointer"
                          checked={cust.email ? selectedCustomerEmails.includes(cust.email) : false}
                          onChange={(e) => handleSelectOne(cust.email, e.target.checked)}
                        />
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{cust._id}</td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        <Avatar initials={cust.initials} className="bg-primary text-primary-foreground border shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{cust.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{cust.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {cust.company || "Individual"}
                        </p>
                        {cust.gstin && (
                          <p className="text-[10px] font-mono text-primary font-bold mt-0.5">GSTIN: {cust.gstin}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {(cust.customerTypes || ["B2C"]).map(type => (
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
                          {cust.upgradeStatus === "pending" && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                              ⏳ Upgrade Pending
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold whitespace-nowrap">{cust.ordersCount} orders</td>
                      <td className="px-6 py-4 text-right font-black text-foreground whitespace-nowrap">
                        {formatPrice(cust.totalSpend)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/admin/customers/${cust._id}`}>
                            <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0" title="View Profile">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0" title="Edit Customer" onClick={() => handleOpenEditModal(cust)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" className="font-semibold h-8 w-8 p-0 text-destructive hover:bg-destructive/5 hover:text-destructive" title="Delete Customer" onClick={() => handleDeleteCustomer(cust._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 pb-1 pt-0">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={customerStats.length}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <CustomerFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchCustomers();
        }}
        editingCustomer={editingCustomer}
      />

      {/* Bulk Mail Modal */}
      {isMailModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border rounded-xl max-w-2xl w-full shadow-2xl p-6 text-foreground space-y-4">
            <div>
              <h3 className="text-xl font-bold tracking-tight">Send Bulk Email</h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Sending email to {selectedCustomerEmails.length} selected customer(s).
              </p>
            </div>

            <form onSubmit={handleSendBulkMail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground text-xs">To</label>
                <div className="p-2 border rounded-md bg-secondary/20 text-xs max-h-24 overflow-y-auto">
                  {selectedCustomerEmails.join(", ")}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground text-xs">Subject *</label>
                <Input
                  placeholder="Email Subject"
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground text-xs">Message *</label>
                <RichTextEditor
                  value={mailContent}
                  onChange={setMailContent}
                  placeholder="Write your email content here..."
                  minHeight="300px"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsMailModalOpen(false)} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSendingMail} className="w-full sm:w-auto">
                  {isSendingMail ? "Sending..." : "Send Email"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

