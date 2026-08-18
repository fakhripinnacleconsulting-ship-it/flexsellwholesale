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
import { orderService } from "@/services/orderService";
import { invoiceService } from "@/services/invoiceService";
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
      addToast(err.message || "Failed to record the payment", "error");
    } finally {
      setIsPaySubmitting(false);
    }
  };

  const handleConvertQuoteToOrder = async (quote: Invoice) => {
    try {
      invoiceForm.setIsSubmitting(true);

      const normalizedItems = (quote.items || []).map((i: any, idx: number) => {
        const pId = typeof i.product === "object" ? (i.product?._id || i.productId || `PROD-${idx}`) : (i.productId || (typeof i.product === "string" ? i.product : `PROD-${idx}`));
        const pTitle = typeof i.product === "object" ? (i.product?.title || i.product?.name || "Wholesale Product") : (i.productTitle || i.name || i.title || "Wholesale Product");
        return {
          id: i.id || i._id || `item-${idx}-${Date.now()}`,
          productId: pId,
          product: {
            _id: pId,
            title: pTitle,
            categoryId: i.product?.categoryId || i.categoryId || "cat-default",
            gstRate: i.product?.gstRate || i.gstRate || 18,
            priceIncludesGst: i.product?.priceIncludesGst ?? true,
          },
          selectedVariants: i.selectedVariants || i.variants || {},
          quantity: Number(i.quantity || 1),
          pricePerUnit: Number(i.pricePerUnit || i.price || 0)
        };
      });

      const shippingAddress = quote.shippingAddress || {
        firstName: quote.customerName ? quote.customerName.split(" ")[0] : "Client",
        lastName: quote.customerName ? quote.customerName.split(" ").slice(1).join(" ") || "Buyer" : "Buyer",
        email: quote.customerEmail || "customer@example.com",
        company: (quote as any).customerCompany || (quote.shippingAddress as any)?.company || "",
        address: "Wholesale Dock Facility Address",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        phone: "9876543210",
        gstin: quote.customerGstin || ""
      };

      const newOrder = await orderService.createOrder(
        normalizedItems as any,
        quote.amount,
        shippingAddress as any,
        {
          paymentMethod: quote.paymentMethod || "Bank Transfer",
          paymentStatus: "Pending"
        },
        quote.couponCode,
        quote.couponDiscount,
        quote._id,
        quote.salesperson
      );

      addToast(`Quote ${quote._id} converted & Order ${newOrder._id} created successfully!`, "success");
      setSelectedInvoice(null);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to convert quote to order", "error");
    } finally {
      invoiceForm.setIsSubmitting(false);
    }
  };

  const handleUpdateQuoteStatus = async (newStatus: string) => {
    if (!selectedInvoice) return;
    if (newStatus === "converted") {
      await handleConvertQuoteToOrder(selectedInvoice);
      return;
    }
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
            onConvertQuote={handleConvertQuoteToOrder}
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
