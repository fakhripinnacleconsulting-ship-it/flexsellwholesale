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
import { Customer, Invoice, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";

// Modular Invoice Sub-Components
import { InvoiceAnalyticsHeader } from "@/components/admin/invoice/InvoiceAnalyticsHeader";
import { InvoiceTabsHeader } from "@/components/admin/invoice/InvoiceTabsHeader";
import { InvoiceTableFilters } from "@/components/admin/invoice/InvoiceTableFilters";
import { InvoiceTable } from "@/components/admin/invoice/InvoiceTable";
import { CompanyInformationTab, CompanyInfoData } from "@/components/admin/invoice/CompanyInformationTab";
import { InvoiceCreateModal } from "@/components/admin/invoice/InvoiceCreateModal";
import { InvoicePayModal } from "@/components/admin/invoice/InvoicePayModal";
import { InvoicePreviewModal } from "@/components/admin/invoice/InvoicePreviewModal";

export default function AdminInvoicesPage() {
  const { invoices, totalPages, page, initializeInvoices, createInvoice, updateInvoice, voidInvoice, deleteInvoice, isLoading } = useInvoiceStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  const [activeTab, setActiveTab] = React.useState<"invoice" | "receipt" | "quote" | "company_info">("quote");
  const [activeSubTab, setActiveSubTab] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [salesperson, setSalesperson] = React.useState("");

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

  // Creation Form State
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [formDocType, setFormDocType] = React.useState<"invoice" | "receipt" | "quote">("invoice");
  const [formCustomerType, setFormCustomerType] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  React.useEffect(() => {
    shippingService.getConfig()
      .then((cfg: any) => setShippingConfig(cfg))
      .catch((err: any) => console.error("Failed to load shipping config:", err));
  }, []);
  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");

  // Customer Fields
  const [newCustName, setNewCustName] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustCompany, setNewCustCompany] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");
  const [newCustAddress, setNewCustAddress] = React.useState("");
  const [newCustCity, setNewCustCity] = React.useState("");
  const [newCustState, setNewCustState] = React.useState(INDIAN_STATES[0]);
  const [newCustPinCode, setNewCustPinCode] = React.useState("");

  // Customer Auto-Fill
  React.useEffect(() => {
    if (selectedCustomerId && customerMode === "existing") {
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (cust) {
        setNewCustName(cust.name || "");
        setNewCustEmail(cust.email || "");
        setNewCustPhone(cust.phone || "");
        setNewCustCompany(cust.company || "");
        setNewCustGstin(cust.gstin || "");
        const defaultAddr = cust.addresses?.find(a => a.isDefault) || cust.addresses?.[0];
        setNewCustAddress(defaultAddr?.address || cust.address || "");
        setNewCustCity(defaultAddr?.city || cust.city || "");
        setNewCustState(defaultAddr?.state || cust.state || INDIAN_STATES[0]);
        setNewCustPinCode(defaultAddr?.pinCode || cust.pinCode || "");
      }
    }
  }, [selectedCustomerId, customerMode, customers]);

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [payInvoiceId, setPayInvoiceId] = React.useState<string | null>(null);
  const [payInvoiceType, setPayInvoiceType] = React.useState<"invoice" | "receipt" | "quote">("receipt");
  const [paymentType, setPaymentType] = React.useState<"cash" | "online">("cash");
  const [onlineMethod, setOnlineMethod] = React.useState<"UPI" | "Razorpay" | "Bank Transfer">("UPI");
  const [txnId, setTxnId] = React.useState("");

  // Line Items & Form Inputs
  const [formItems, setFormItems] = React.useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState("");
  const [selectedSize, setSelectedSize] = React.useState("");
  const [selectedWeight, setSelectedWeight] = React.useState("");
  const [itemQty, setItemQty] = React.useState(1);
  const [itemPrice, setItemPrice] = React.useState(0);

  // Payment details for creation
  const [paymentMethod, setPaymentMethod] = React.useState("Bank Transfer");
  const [paymentStatus, setPaymentStatus] = React.useState("Paid");
  const [transactionId, setTransactionId] = React.useState("");
  const [invoiceNotes, setInvoiceNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editInvoiceId, setEditInvoiceId] = React.useState<string | null>(null);
  const [productSearch, setProductSearch] = React.useState("");

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
      customerType: activeTab === "quote" ? undefined : activeSubTab
    });
  }, [activeTab, statusFilter, startDate, endDate, searchTerm, currentPage, activeSubTab, initializeInvoices]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("createQuote") === "true") {
        setFormDocType("quote");
        setIsCreateModalOpen(true);
      }
    }
  }, []);

  React.useEffect(() => {
    if (isCreateModalOpen) {
      setFormDocType(activeTab === "company_info" ? "quote" : activeTab);
      initializeProducts();
      customerService.getCustomers()
        .then(setCustomers)
        .catch(err => console.error("Failed to load customers:", err));
      shippingService.getConfig()
        .catch(err => console.error("Failed to load shipping config:", err));
    }
  }, [isCreateModalOpen, initializeProducts, activeTab]);

  // Document Handlers
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      addToast("Please add at least one line item.", "warning");
      return;
    }

    let customerPayload: any = {};
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        addToast("Please select a registered client.", "warning");
        return;
      }
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (!cust) {
        addToast("Selected client record not found.", "error");
        return;
      }
      customerPayload = {
        customerId: cust._id,
        customerName: cust.name,
        customerEmail: cust.email,
        customerGstin: cust.gstin,
        shippingAddress: {
          firstName: cust.name.split(" ")[0] || "Client",
          lastName: cust.name.split(" ").slice(1).join(" ") || String(formCustomerType),
          email: cust.email,
          company: cust.company,
          address: cust.address || "Warehouse Pickup Address",
          city: cust.city || "Indore",
          state: cust.state || "Madhya Pradesh",
          pinCode: cust.pinCode || "452001",
          phone: cust.phone || "+919876543210",
          gstin: cust.gstin
        }
      };
    } else {
      if (!newCustName || !newCustEmail || !newCustAddress || !newCustCity || !newCustPinCode || !newCustPhone) {
        addToast("Please fill in all required new customer fields.", "warning");
        return;
      }
      customerPayload = {
        newCustomer: {
          name: newCustName,
          email: newCustEmail,
          phone: newCustPhone,
          company: newCustCompany || undefined,
          gstin: newCustGstin || undefined,
          address: newCustAddress,
          city: newCustCity,
          state: newCustState,
          pinCode: newCustPinCode,
          customerTypes: [formCustomerType],
        },
        customerName: newCustName,
        customerEmail: newCustEmail.toLowerCase(),
        customerGstin: newCustGstin || undefined,
        shippingAddress: {
          firstName: newCustName.split(" ")[0] || "Client",
          lastName: newCustName.split(" ").slice(1).join(" ") || String(formCustomerType),
          email: newCustEmail.toLowerCase(),
          company: newCustCompany || undefined,
          address: newCustAddress,
          city: newCustCity,
          state: newCustState,
          pinCode: newCustPinCode,
          phone: newCustPhone,
          gstin: newCustGstin || undefined
        }
      };
    }

    setIsSubmitting(true);
    try {
      const isIntrastate = (newCustState || INDIAN_STATES[0]).toLowerCase() === "madhya pradesh";
      let baseSubtotal = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;
      const slabsMap: Record<string, { base: number; tax: number; rate: number }> = {};

      formItems.forEach(item => {
        const lineGross = item.pricePerUnit * item.quantity;
        const rate = item.gstRate || 18;
        const lineBase = lineGross / (1 + rate / 100);
        const lineTax = lineGross - lineBase;
        baseSubtotal += lineBase;

        if (!slabsMap[item.hsnCode]) {
          slabsMap[item.hsnCode] = { base: 0, tax: 0, rate };
        }
        slabsMap[item.hsnCode].base += lineBase;
        slabsMap[item.hsnCode].tax += lineTax;

        if (isIntrastate) {
          totalCgst += lineTax / 2;
          totalSgst += lineTax / 2;
        } else {
          totalIgst += lineTax;
        }
      });

      const hsnSlabs = Object.entries(slabsMap).map(([hsnCode, d]) => ({
        hsnCode,
        gstRate: d.rate,
        baseAmount: d.base,
        totalTax: d.tax,
        cgst: isIntrastate ? d.tax / 2 : 0,
        sgst: isIntrastate ? d.tax / 2 : 0,
        igst: isIntrastate ? 0 : d.tax,
      }));

      const formTaxBreakdown: TaxBreakdown = {
        isIntrastate,
        baseSubtotal,
        cgst: totalCgst,
        sgst: totalSgst,
        igst: totalIgst,
        hsnSlabs,
      };

      const { calculateTotalShippingCharge } = require("@/lib/shippingHelper");
      const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");

      const itemsSubtotal = formItems.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

      const itemsWithTier = formItems.map(item => ({
        ...item,
        priceTier: formCustomerType
      }));

      const computedShippingCharge = calculateTotalShippingCharge(
        itemsWithTier,
        shippingConfig,
        calculateShippingByWeight,
        calculateEffectiveUnitWeightGrams
      );

      const formGrandTotal = itemsSubtotal + computedShippingCharge;

      const payloadData = {
        type: formDocType,
        ...customerPayload,
        items: formItems,
        amount: formGrandTotal,
        shippingCharge: computedShippingCharge,
        taxDetails: formTaxBreakdown,
        paymentMethod: formDocType === "quote" ? undefined : paymentMethod,
        paymentStatus: formDocType === "quote" ? "Pending" : (formDocType === "invoice" ? "Paid" : paymentStatus),
        transactionId: (formDocType === "quote" || (formDocType === "receipt" && paymentStatus !== "Paid")) ? undefined : transactionId || undefined,
        notes: invoiceNotes || undefined,
        salesperson: salesperson || undefined,
        customerType: formCustomerType
      };

      if (editInvoiceId) {
        await updateInvoice(editInvoiceId, payloadData as any);
        addToast("Quote updated successfully!", "success");
      } else {
        await createInvoice(payloadData as any);
        const docLabel = formDocType === "invoice" ? "Invoice" : formDocType === "receipt" ? "Receipt" : "Price Quote";
        addToast(`${docLabel} generated successfully!`, "success");
      }
      setIsCreateModalOpen(false);
      setEditInvoiceId(null);
      setProductSearch("");

      // Reset form
      setFormItems([]);
      setSelectedCustomerId("");
      setNewCustName("");
      setNewCustEmail("");
      setNewCustPhone("");
      setNewCustCompany("");
      setNewCustGstin("");
      setNewCustAddress("");
      setNewCustCity("");
      setNewCustPinCode("");
      setTransactionId("");
      setInvoiceNotes("");
      setSalesperson("");

      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to save document", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditQuote = (inv: Invoice) => {
    setEditInvoiceId(inv._id);
    setFormDocType(inv.type);
    setFormCustomerType((inv as any).customerType || "B2B");

    if (inv.customerId) {
      setCustomerMode("existing");
      setSelectedCustomerId(inv.customerId);
    } else {
      setCustomerMode("new");
      setNewCustName(inv.customerName);
      setNewCustEmail(inv.customerEmail);
      setNewCustPhone(inv.shippingAddress?.phone || "");
      setNewCustCompany(inv.shippingAddress?.company || "");
      setNewCustGstin(inv.customerGstin || "");
      setNewCustAddress(inv.shippingAddress?.address || "");
      setNewCustCity(inv.shippingAddress?.city || "");
      setNewCustState(inv.shippingAddress?.state || INDIAN_STATES[0]);
      setNewCustPinCode(inv.shippingAddress?.pinCode || "");
    }

    setFormItems(inv.items || []);
    setPaymentMethod(inv.paymentMethod || "Bank Transfer");
    setPaymentStatus(inv.paymentStatus || "Pending");
    setTransactionId(inv.transactionId || "");
    setSalesperson(inv.salesperson || "");
    setInvoiceNotes((inv as any).notes || "");

    setIsCreateModalOpen(true);
  };

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
    setPayInvoiceType(inv.type);
    setTxnId("");
    setPaymentType("cash");
    setOnlineMethod("UPI");
    setIsPayModalOpen(true);
  };

  const handleConfirmPay = async () => {
    if (!payInvoiceId) return;
    const finalTxnId = paymentType === "cash"
      ? (txnId || `CASH-HAND-${Date.now().toString().slice(-4)}`)
      : (txnId || `${onlineMethod.toUpperCase()}-${Date.now().toString().slice(-6)}`);

    try {
      await updateInvoice(payInvoiceId, {
        paymentStatus: "Paid",
        paymentMethod: paymentType === "cash" ? "Cash" : onlineMethod,
        transactionId: finalTxnId,
        type: "invoice"
      } as any);
      setIsPayModalOpen(false);
      addToast(`Payment recorded for document ${payInvoiceId}!`, "success");
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to update status to paid", "error");
    }
  };

  const handleConvertQuoteToOrder = async (quote: Invoice) => {
    try {
      setIsSubmitting(true);

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
      setIsSubmitting(false);
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
        <Button
          onClick={() => {
            setEditInvoiceId(null);
            setProductSearch("");
            setIsCreateModalOpen(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
        >
          <Plus className="h-4.5 w-4.5" /> Generate Document
        </Button>
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
            onEditQuote={handleEditQuote}
            onConvertQuote={handleConvertQuoteToOrder}
            onVoidInvoice={handleVoidInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        </div>
      )}

      {/* Modals */}
      <InvoiceCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        editInvoiceId={editInvoiceId}
        formDocType={formDocType}
        setFormDocType={setFormDocType}
        formCustomerType={formCustomerType}
        setFormCustomerType={setFormCustomerType}
        customers={customers}
        customerMode={customerMode}
        setCustomerMode={setCustomerMode}
        selectedCustomerId={selectedCustomerId}
        setSelectedCustomerId={setSelectedCustomerId}
        newCustName={newCustName}
        setNewCustName={setNewCustName}
        newCustEmail={newCustEmail}
        setNewCustEmail={setNewCustEmail}
        newCustPhone={newCustPhone}
        setNewCustPhone={setNewCustPhone}
        newCustCompany={newCustCompany}
        setNewCustCompany={setNewCustCompany}
        newCustGstin={newCustGstin}
        setNewCustGstin={setNewCustGstin}
        newCustAddress={newCustAddress}
        setNewCustAddress={setNewCustAddress}
        newCustCity={newCustCity}
        setNewCustCity={setNewCustCity}
        newCustState={newCustState}
        setNewCustState={setNewCustState}
        newCustPinCode={newCustPinCode}
        setNewCustPinCode={setNewCustPinCode}
        products={products}
        formItems={formItems}
        setFormItems={setFormItems}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        productSearch={productSearch}
        setProductSearch={setProductSearch}
        selectedColor={selectedColor}
        setSelectedColor={setSelectedColor}
        selectedSize={selectedSize}
        setSelectedSize={setSelectedSize}
        selectedWeight={selectedWeight}
        setSelectedWeight={setSelectedWeight}
        itemQty={itemQty}
        setItemQty={setItemQty}
        itemPrice={itemPrice}
        setItemPrice={setItemPrice}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentStatus={paymentStatus}
        setPaymentStatus={setPaymentStatus}
        transactionId={transactionId}
        setTransactionId={setTransactionId}
        salesperson={salesperson}
        setSalesperson={setSalesperson}
        invoiceNotes={invoiceNotes}
        setInvoiceNotes={setInvoiceNotes}
        isSubmitting={isSubmitting}
        onSaveInvoice={handleSaveInvoice}
        addToast={addToast}
        shippingConfig={shippingConfig}
      />

      <InvoicePayModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        payInvoiceId={payInvoiceId}
        payInvoiceType={payInvoiceType}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        onlineMethod={onlineMethod}
        setOnlineMethod={setOnlineMethod}
        txnId={txnId}
        setTxnId={setTxnId}
        onConfirmPay={handleConfirmPay}
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
