"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { customerService } from "@/services/customerService";
import { shippingService } from "@/services/shippingService";
import { invoiceService } from "@/services/invoiceService";
import { collectOrderPaymentOnline } from "@/lib/razorpayCollect";
import { describePaymentFailure } from "@/lib/paymentErrors";
import * as walletService from "@/services/walletService";
import { Customer, Invoice, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";

// Modular Invoice Sub-Components
import { InvoiceAnalyticsHeader } from "@/components/admin/invoice/InvoiceAnalyticsHeader";
import { InvoiceTabsHeader } from "@/components/admin/invoice/InvoiceTabsHeader";
import { InvoiceTableFilters } from "@/components/admin/invoice/InvoiceTableFilters";
import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import { InvoiceTable } from "@/components/admin/invoice/InvoiceTable";
import { CompanyInformationTab, CompanyInfoData } from "@/components/admin/invoice/CompanyInformationTab";
import { InvoiceCreateModal } from "@/components/admin/invoice/InvoiceCreateModal";
import { InvoicePayModal, PayOnlineMethod } from "@/components/admin/invoice/InvoicePayModal";
import { InvoicePreviewModal } from "@/components/admin/invoice/InvoicePreviewModal";

import { usePermissions } from "@/hooks/usePermissions";

export function AdminInvoicesManager({ initialTab = "quote" }: { initialTab?: "invoice" | "receipt" | "quote" | "company_info" }) {
  const { invoices, totalPages, page, initializeInvoices, createInvoice, updateInvoice, voidInvoice, deleteInvoice, isLoading } = useInvoiceStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);
  const { hasPermission, isManagerRoute } = usePermissions();

  const [activeTab, setActiveTab] = React.useState<"invoice" | "receipt" | "quote" | "company_info">(initialTab);
  const [activeSubTab, setActiveSubTab] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [salesperson, setSalesperson] = React.useState("");
  const [createdByFilter, setCreatedByFilter] = React.useState<string>(isManagerRoute ? "me" : "all");

  // Company Settings State
  const [companyInfo, setCompanyInfo] = React.useState<CompanyInfoData>({
    storeName: "FlexSell Wholesale",
    legalName: "FlexSell Wholesale Sourcing Pvt Ltd",
    gstin: "23AAACD1234D1Z0",
    pan: "AAACD1234D",
    cin: "U74999MP2026PTC012345",
    companyAddress: "2nd floor, Sector B, Plot no 3, Main Rd, Kohefiza, Bhopal, Madhya Pradesh 462001",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pinCode: "462001",
    supportEmail: "support@flexsellwholesale.com",
    supportPhone: "+91 98765 43210",
    websiteUrl: "https://flexsellwholesale.com",
    signatureUrl: "",
    bankName: "HDFC Bank",
    accountName: "FlexSell Wholesale Sourcing Pvt Ltd",
    accountNumber: "50200012345678",
    ifscCode: "HDFC0001234",
    branchName: "Vijay Nagar Branch, Indore",
    termsAndConditions: [
      "Prices represent verified factory-direct wholesale pricing.",
      "Quote valid for 15 calendar days from generation date.",
      "Prices inclusive of GST as per Indian tax norms.",
      "Shipping charges calculated dynamically based on order weight/B2B flat rate.",
      "Subject to stock availability at time of order placement."
    ]
  });
  // Selected Invoice Detail / Preview Modal State
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedInvoice(null);
  }, [activeTab, activeSubTab]);

  // Load Company Settings from CMS
  React.useEffect(() => {
    fetch("/api/cms")
      .then(res => res.json())
      .then(data => {
        if (data?.businessSettings) {
          setCompanyInfo(prev => ({
            ...prev,
            ...data.businessSettings,
            termsAndConditions: Array.isArray(data.businessSettings.termsAndConditions) && data.businessSettings.termsAndConditions.length > 0
              ? data.businessSettings.termsAndConditions
              : prev.termsAndConditions,
          }));
        }
      })
      .catch(err => console.error("Failed to load company info from CMS:", err));
  }, []);

  const invoiceForm = useInvoiceForm({
    onSuccess: () => loadData()
  });

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [payInvoiceId, setPayInvoiceId] = React.useState<string | null>(null);
  /** The order behind the receipt being paid — the gateway charges an order, not a document. */
  const [payOrderId, setPayOrderId] = React.useState<string | null>(null);
  const [payCustomer, setPayCustomer] = React.useState<{ name?: string; email?: string; phone?: string }>({});
  const [paymentType, setPaymentType] = React.useState<"cash" | "online">("cash");
  const [onlineMethod, setOnlineMethod] = React.useState<PayOnlineMethod>("UPI");
  const [txnId, setTxnId] = React.useState("");
  const [payAmount, setPayAmount] = React.useState(0);
  const [isPaySubmitting, setIsPaySubmitting] = React.useState(false);
  /**
   * Minted when the modal opens, not when it submits.
   *
   * That is what makes a double-click settle once: every retry of this one intent carries
   * the same key, and the ledger is append-only so a duplicate debit could only be undone
   * by an admin reversal the customer would also see.
   */
  const [payRequestId, setPayRequestId] = React.useState<string>("");

  const [walletBalance, setWalletBalance] = React.useState(0);
  const [businessWalletBalance, setBusinessWalletBalance] = React.useState(0);

  // Data fetching
  const loadData = React.useCallback(async () => {
    if (activeTab === "company_info") return;
    initializeInvoices({
      type: activeTab,
      status: statusFilter || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: searchTerm || undefined,
      page: currentPage,
      limit: 10,
      customerType: activeTab === "quote" ? undefined : activeSubTab,
      createdBy: createdByFilter !== "all" ? createdByFilter : undefined
    });
  }, [activeTab, statusFilter, startDate, endDate, searchTerm, currentPage, activeSubTab, createdByFilter, initializeInvoices]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("createQuote") === "true") {
        invoiceForm.setFormDocType("quote");
        invoiceForm.setIsCreateModalOpen(true);
      } else if (params.get("createOrder") === "true") {
        invoiceForm.setFormDocType("receipt");
        invoiceForm.setIsOrderCreationMode(true);
        invoiceForm.setFormCustomerType("Dropshipping");
        invoiceForm.setIsCreateModalOpen(true);
      }
    }
  }, []);





  const handleVoidInvoice = async (id: string) => {
    confirmAction({
      title: "Void Commercial Document",
      message: `Are you sure you want to void Document ${id}? It will be marked as void and disabled.`,
      confirmText: "Void Document",
      type: "danger",
      onConfirm: async () => {
        try {
          await voidInvoice(id);
          addToast(`Document ${id} voided successfully!`, "success");
          loadData();
        } catch (err: any) {
          addToast(err.message || "Failed to void document", "error");
        }
      }
    });
  };

  const handleDeleteInvoice = async (id: string) => {
    confirmAction({
      title: "Delete Document Record",
      message: `Permanently delete document ${id}? This action cannot be undone.`,
      confirmText: "Delete Permanently",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteInvoice(id);
          addToast(`Document ${id} deleted successfully!`, "success");
          loadData();
        } catch (err: any) {
          addToast(err.message || "Failed to delete document", "error");
        }
      }
    });
  };

  const handlePayInvoice = (inv: Invoice) => {
    setPayInvoiceId(inv._id);
    setPayOrderId(inv.orderId || null);
    setPayCustomer({
      name: inv.customerName,
      email: inv.customerEmail,
      phone: inv.shippingAddress?.phone,
    });
    setPayAmount(Number(inv.amount) || 0);
    setTxnId("");
    setPaymentType("cash");
    setOnlineMethod("UPI");
    setPayRequestId(walletService.newRequestId());

    const custId = inv.customerId || (inv as any).customer?._id || (inv as any).customer;
    if (custId) {
      walletService
        .getWallets(String(custId))
        .then((res) => {
          setWalletBalance(res.store?.availableBalance || 0);
          setBusinessWalletBalance(res.business?.availableBalance || 0);
        })
        .catch(() => {
          setWalletBalance(0);
          setBusinessWalletBalance(0);
        });
    } else {
      setWalletBalance(0);
      setBusinessWalletBalance(0);
    }

    setIsPayModalOpen(true);
  };

  /**
   * Records the payment through the settle endpoint.
   *
   * This used to call `updateInvoice({ paymentStatus: "Paid", paymentMethod: "Store Wallet",
   * type: "invoice" })`. That marked the document paid without ever calling the wallet, so a
   * customer with ₹0 was settled in full, and it flipped `type` in place so the resulting Tax
   * Invoice kept its `REC-` number. `/settle` moves the money first and issues a real `INV-`
   * document; a short balance comes back as a 409 and nothing changes.
   */
  const handleConfirmPay = async () => {
    if (!payInvoiceId || isPaySubmitting) return;

    const method = paymentType === "cash" ? "Cash" : onlineMethod;
    setIsPaySubmitting(true);

    /**
     * Razorpay is collected, not recorded.
     *
     * `/settle` records money already in hand, so it refuses the gateway outright. The
     * gateway runs here against the receipt's linked order and settles through
     * `/api/razorpay/verify`, which issues the `INV-` on a verified signature — the same
     * path the storefront checkout uses.
     */
    if (method === "Razorpay") {
      if (!payOrderId) {
        addToast("This receipt has no linked order, so the gateway has nothing to charge.", "error");
        setIsPaySubmitting(false);
        return;
      }
      try {
        const outcome = await collectOrderPaymentOnline({
          orderId: payOrderId,
          customerName: payCustomer.name,
          customerEmail: payCustomer.email,
          customerPhone: payCustomer.phone,
          description: `Payment for receipt ${payInvoiceId}`,
        });
        if (outcome.status === "paid") {
          setIsPayModalOpen(false);
          addToast(`Payment received. Tax Invoice issued for ${payInvoiceId}.`, "success");
          loadData();
        } else {
          addToast("Payment cancelled — the receipt is unchanged and still payable.", "info");
        }
      } catch (err: any) {
        addToast(describePaymentFailure(err), "error");
      } finally {
        setIsPaySubmitting(false);
      }
      return;
    }

    try {
      const result = await invoiceService.settleInvoice(payInvoiceId, {
        method,
        transactionId: txnId.trim() || undefined,
        clientRequestId: payRequestId,
      });
      setIsPayModalOpen(false);
      addToast(result.message || `Tax Invoice ${result.invoiceId} issued.`, "success");
      loadData();
    } catch (err: any) {
      addToast(describePaymentFailure(err, { fallback: "The payment could not be recorded." }), "error");
    } finally {
      setIsPaySubmitting(false);
    }
  };

  /**
   * Quotes are standalone price estimates.
   *
   * The conversion handler that used to live here rebuilt the quote's lines and posted them
   * to `orderService.createOrder`, then marked the quote `converted`. Quotations no longer
   * become orders, receipts or invoices at all, so the status a user picks is just a status.
   */
  const handleUpdateQuoteStatus = async (newStatus: string) => {
    if (!selectedInvoice) return;
    try {
      await updateInvoice(selectedInvoice._id, { status: newStatus } as any);
      setSelectedInvoice(prev => prev ? ({ ...prev, status: newStatus as any }) : null);
      addToast(`Quote status updated to ${newStatus}!`, "success");
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to update quote status", "error");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* ─── TITLE & TOP ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Invoice & Receipt Manager</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Persist, monitor, and print commercial invoices, payment receipts, and price quotes.
          </p>
        </div>
        {hasPermission(`invoices_${activeTab}` as any, "create") && (
          <Button
            onClick={() => {
              invoiceForm.setFormDocType(activeTab === "company_info" ? "quote" : activeTab);
              invoiceForm.setIsCreateModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
          >
            <Plus className="h-4.5 w-4.5" /> Generate Document
          </Button>
        )}
      </div>

      {/* Analytics Summary */}
      <InvoiceAnalyticsHeader
        activeTab={activeTab}
        invoices={invoices}
      />

      {/* Navigation Tabs */}
      <InvoiceTabsHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        onTabChange={() => setCurrentPage(1)}
      />

      {/* Main View Area: Company Information OR Invoice List Table */}
      {activeTab === "company_info" ? (
        <CompanyInformationTab
          companyInfo={companyInfo}
          setCompanyInfo={setCompanyInfo}
        />
      ) : (
        <div className="space-y-4">
          <InvoiceTableFilters
            activeTab={activeTab}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            setEndDate={setEndDate}
            createdByFilter={createdByFilter}
            setCreatedByFilter={setCreatedByFilter}
          />

          <InvoiceTable
            invoices={invoices}
            isLoading={isLoading}
            activeTab={activeTab}
            page={page}
            totalPages={totalPages}
            setCurrentPage={setCurrentPage}
            onViewInvoice={setSelectedInvoice}
            onPayInvoice={handlePayInvoice}
            onEditQuote={invoiceForm.handleEditQuote}
            onVoidInvoice={handleVoidInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        </div>
      )}

      {/* Modals */}
      <InvoiceCreateModal
        {...invoiceForm}
        isOpen={invoiceForm.isCreateModalOpen}
        onClose={() => invoiceForm.setIsCreateModalOpen(false)}
        onSaveInvoice={invoiceForm.handleSaveInvoice}
      />

      <InvoicePayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        payInvoiceId={payInvoiceId}
        linkedOrderId={payOrderId}
        payAmount={payAmount}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        onlineMethod={onlineMethod}
        setOnlineMethod={setOnlineMethod}
        txnId={txnId}
        setTxnId={setTxnId}
        onConfirmPay={handleConfirmPay}
        isSubmitting={isPaySubmitting}
        walletBalance={walletBalance}
        businessWalletBalance={businessWalletBalance}
      />

      <InvoicePreviewModal
        selectedInvoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        companyInfo={companyInfo}
        onUpdateStatus={handleUpdateQuoteStatus}
      />
    </div>
  );
}
