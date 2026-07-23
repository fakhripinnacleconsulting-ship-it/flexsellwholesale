"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Eye, Plus, Trash2, Calendar, FileText, X, Check, Loader2, ArrowLeft, Printer, RefreshCw, Edit } from "lucide-react";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { useConfirmStore } from "@/stores/confirmStore";
import { customerService } from "@/services/customerService";
import { shippingService } from "@/services/shippingService";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { formatPrice } from "@/lib/utils";
import { Customer, Product, Invoice, CartItem, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";
import { resolvePrice, resolveMoq } from "@/lib/priceTierHelper";
import CustomerSearchPicker from "@/components/admin/CustomerSearchPicker";

export default function AdminInvoicesPage() {
  const { invoices, total, page, totalPages, initializeInvoices, createInvoice, updateInvoice, voidInvoice, deleteInvoice, isLoading } = useInvoiceStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();
  const confirmAction = useConfirmStore((state) => state.confirm);

  const [activeTab, setActiveTab] = React.useState<"invoice" | "receipt" | "quote">("quote");
  const [activeSubTab, setActiveSubTab] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [salesperson, setSalesperson] = React.useState("");

  // Detail View State
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedInvoice(null);
  }, [activeTab, activeSubTab]);

  // Creation Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [formDocType, setFormDocType] = React.useState<"invoice" | "receipt" | "quote">("invoice");
  const [formCustomerType, setFormCustomerType] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [shippingConfig, setShippingConfig] = React.useState<any>(null);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");

  // New Customer Fields
  const [newCustName, setNewCustName] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustCompany, setNewCustCompany] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");
  const [newCustAddress, setNewCustAddress] = React.useState("");
  const [newCustCity, setNewCustCity] = React.useState("");
  const [newCustState, setNewCustState] = React.useState(INDIAN_STATES[0]);
  const [newCustPinCode, setNewCustPinCode] = React.useState("");

  // Pay Modal State
  const [isPayModalOpen, setIsPayModalOpen] = React.useState(false);
  const [payInvoiceId, setPayInvoiceId] = React.useState<string | null>(null);
  const [payInvoiceType, setPayInvoiceType] = React.useState<"invoice" | "receipt" | "quote">("receipt");
  const [paymentType, setPaymentType] = React.useState<"cash" | "online">("cash");
  const [onlineMethod, setOnlineMethod] = React.useState<"UPI" | "Razorpay" | "Bank Transfer">("UPI");
  const [txnId, setTxnId] = React.useState("");

  // Invoice Items
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
  const [isProductDropdownOpen, setIsProductDropdownOpen] = React.useState(false);
  const productWrapperRef = React.useRef<HTMLDivElement>(null);

  // Fetch data
  const loadData = React.useCallback(async () => {
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
    // Load products and customers for generation modal
    if (isCreateModalOpen) {
      setFormDocType(activeTab);
      initializeProducts();
      customerService.getCustomers()
        .then(setCustomers)
        .catch(err => console.error("Failed to load customers:", err));
      shippingService.getConfig()
        .then(setShippingConfig)
        .catch(err => console.error("Failed to load shipping config:", err));
    }
  }, [isCreateModalOpen, initializeProducts, activeTab]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productWrapperRef.current && !productWrapperRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
        const matched = products.find(p => p._id === selectedProductId);
        if (matched) {
          setProductSearch(matched.title);
        } else {
          setProductSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [products, selectedProductId]);

  const filteredProductsForSelect = React.useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter(p => {
      if (
        p._id.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        (p.hsnCode && p.hsnCode.toLowerCase().includes(q))
      ) {
        return true;
      }
      return p.colorVariants?.some(cv =>
        cv.subVariants?.some(sv =>
          (sv.sku && sv.sku.toLowerCase().includes(q)) ||
          (sv.barcode && sv.barcode.toLowerCase().includes(q))
        )
      ) || false;
    });
  }, [products, productSearch]);

  React.useEffect(() => {
    if (selectedProductId) {
      const match = products.find(p => p._id === selectedProductId);
      if (match) {
        setProductSearch(match.title);
      }
    } else {
      setProductSearch("");
    }
  }, [selectedProductId, products]);

  // Handle Product Select in Creation Form to setup variant drop downs
  const currentSelectedProduct = React.useMemo(() => {
    return products.find(p => p._id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const availableColors = React.useMemo(() => {
    if (!currentSelectedProduct) return [];
    return currentSelectedProduct.colorVariants?.map(v => v.color) || [];
  }, [currentSelectedProduct]);

  const currentSelectedColorVariant = React.useMemo(() => {
    if (!currentSelectedProduct || !selectedColor) return null;
    return currentSelectedProduct.colorVariants?.find(v => v.color === selectedColor) || null;
  }, [currentSelectedProduct, selectedColor]);

  const availableSizes = React.useMemo(() => {
    if (!currentSelectedColorVariant) return [];
    return Array.from(new Set(currentSelectedColorVariant.subVariants.map(sv => sv.size).filter(Boolean)));
  }, [currentSelectedColorVariant]);

  const availableWeights = React.useMemo(() => {
    if (!currentSelectedColorVariant) return [];
    return Array.from(new Set(currentSelectedColorVariant.subVariants.map(sv => sv.weight).filter(Boolean)));
  }, [currentSelectedColorVariant]);

  // Set default price when variant is matched
  React.useEffect(() => {
    if (!currentSelectedColorVariant) return;
    const sub = currentSelectedColorVariant.subVariants.find(sv =>
      (!selectedSize || sv.size === selectedSize) &&
      (!selectedWeight || sv.weight === selectedWeight)
    ) || currentSelectedColorVariant.subVariants[0];

    if (sub) {
      setItemPrice(resolvePrice(sub, formCustomerType));
    }
  }, [currentSelectedColorVariant, selectedSize, selectedWeight, formCustomerType]);

  // Reset variant selections when selected product changes
  React.useEffect(() => {
    if (currentSelectedProduct) {
      const defaultColor = currentSelectedProduct.colorVariants?.[0]?.color || "";
      setSelectedColor(defaultColor);
      setSelectedSize("");
      setSelectedWeight("");
    } else {
      setSelectedColor("");
      setSelectedSize("");
      setSelectedWeight("");
    }
  }, [currentSelectedProduct]);

  // Add Item to creation list
  const handleAddItem = () => {
    if (!currentSelectedProduct) return;

    const subVar = currentSelectedColorVariant?.subVariants.find(sv =>
      (!selectedSize || sv.size === selectedSize) &&
      (!selectedWeight || sv.weight === selectedWeight)
    ) || currentSelectedColorVariant?.subVariants[0];

    if (!subVar) {
      addToast("Failed to match variant details.", "error");
      return;
    }

    const moq = resolveMoq(subVar, formCustomerType as any);
    if (itemQty < moq) {
      addToast(`Minimum Order Quantity (MOQ) for this variant is ${moq} units.`, "warning");
      return;
    }

    const uniqueId = `${selectedProductId}-${selectedColor}-${selectedSize}-${selectedWeight}`;

    // Check duplicate
    if (formItems.some(i => i.id === uniqueId)) {
      addToast("This item option is already added to the list.", "warning");
      return;
    }

    const selectedVariants: Record<string, string> = {};
    if (selectedColor) selectedVariants["Color"] = selectedColor;
    if (selectedSize) selectedVariants["Size"] = selectedSize;
    if (selectedWeight) selectedVariants["Weight"] = selectedWeight;

    const newItem = {
      id: uniqueId,
      productId: selectedProductId,
      product: {
        _id: currentSelectedProduct._id,
        title: currentSelectedProduct.title,
        categoryId: currentSelectedProduct.categoryId,
        gstRate: currentSelectedProduct.gstRate || 18,
        priceIncludesGst: currentSelectedProduct.priceIncludesGst ?? true,
        hsnCode: currentSelectedProduct.hsnCode || "3924",
        colorVariants: currentSelectedProduct.colorVariants
      },
      selectedVariants,
      quantity: itemQty,
      pricePerUnit: itemPrice || (currentSelectedProduct ? resolvePrice(subVar, formCustomerType) : 0)
    };

    setFormItems(prev => [...prev, newItem]);
    addToast("Item added to summary.", "success");

    // Reset selection
    setSelectedProductId("");
    setItemQty(1);
    setItemPrice(0);
  };

  const handleRemoveItem = (id: string) => {
    setFormItems(prev => prev.filter(i => i.id !== id));
  };

  // Filter registered customers by formCustomerType ordering mode
  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => c.customerTypes?.includes(formCustomerType));
  }, [customers, formCustomerType]);

  // Determine buyer state for tax preview
  const buyerStateForForm = React.useMemo(() => {
    if (customerMode === "new") return newCustState;
    const cust = customers.find(c => c._id === selectedCustomerId);
    return cust?.state || INDIAN_STATES[0];
  }, [customerMode, selectedCustomerId, customers, newCustState]);

  // Calculate summary totals dynamically
  const formTaxBreakdown = React.useMemo(() => {
    const isIntrastate = buyerStateForForm.toLowerCase() === "madhya pradesh"; // matching seller default
    let baseSubtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    const hsnMap: Record<string, any> = {};

    formItems.forEach((item) => {
      const rate = item.product.gstRate ?? 18;
      const hsn = item.product.hsnCode ?? "3924";
      const isIncl = item.product.priceIncludesGst ?? true;
      const totalItemAmount = item.pricePerUnit * item.quantity;

      let itemBase = 0;
      let itemTax = 0;

      if (isIncl) {
        itemBase = totalItemAmount / (1 + rate / 100);
        itemTax = totalItemAmount - itemBase;
      } else {
        itemBase = totalItemAmount;
        itemTax = itemBase * (rate / 100);
      }

      baseSubtotal += itemBase;
      let cgst = 0, sgst = 0, igst = 0;
      if (isIntrastate) {
        cgst = itemTax / 2;
        sgst = itemTax / 2;
        totalCgst += cgst;
        totalSgst += sgst;
      } else {
        igst = itemTax;
        totalIgst += igst;
      }

      if (!hsnMap[hsn]) {
        hsnMap[hsn] = { hsnCode: hsn, gstRate: rate, baseAmount: 0, totalTax: 0, cgst: 0, sgst: 0, igst: 0 };
      }
      hsnMap[hsn].baseAmount += itemBase;
      hsnMap[hsn].totalTax += itemTax;
      hsnMap[hsn].cgst += cgst;
      hsnMap[hsn].sgst += sgst;
      hsnMap[hsn].igst += igst;
    });

    return {
      isIntrastate,
      baseSubtotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      hsnSlabs: Object.values(hsnMap)
    };
  }, [formItems, buyerStateForForm]);

  const formTotalWeight = React.useMemo(() => {
    return formItems.reduce((sum, item) => {
      const unitWeightStr = item.selectedVariants["Weight"] || "";
      const parseWeightToGrams = (wStr: string): number => {
        if (!wStr) return 0;
        const clean = wStr.toLowerCase().trim();
        const val = parseFloat(clean);
        if (isNaN(val)) return 0;
        if (clean.includes("kg")) return val * 1000;
        return val;
      };
      return sum + (parseWeightToGrams(unitWeightStr) * item.quantity);
    }, 0);
  }, [formItems]);

  const formShippingCharge = React.useMemo(() => {
    if (formCustomerType === "B2B") {
      return shippingConfig?.b2bFixedCharge ?? 150;
    } else {
      const slabs = shippingConfig?.weightSlabs || [];
      if (slabs.length === 0) return 0;
      const matchedSlab = slabs.find((s: any) => formTotalWeight >= s.fromGram && formTotalWeight <= s.uptoGram);
      return matchedSlab ? matchedSlab.amount : 0;
    }
  }, [formCustomerType, formTotalWeight, shippingConfig]);

  const formItemsTotal = React.useMemo(() => {
    return formItems.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0);
  }, [formItems]);

  const formGrandTotal = React.useMemo(() => {
    return formItemsTotal + formShippingCharge;
  }, [formItemsTotal, formShippingCharge]);

  // Submit invoice creation/edit
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formItems.length === 0) {
      addToast("Please add at least one item to generate an invoice.", "warning");
      return;
    }

    if (formCustomerType === "B2B" && customerMode === "new") {
      if (!newCustCompany) {
        addToast("Company name is required for B2B clients.", "warning");
        return;
      }
      if (!newCustGstin) {
        addToast("GSTIN is required for B2B clients.", "warning");
        return;
      }
    }

    let customerPayload: any = {};
    if (customerMode === "existing") {
      if (!selectedCustomerId) {
        addToast("Please select a customer.", "warning");
        return;
      }
      const cust = customers.find(c => c._id === selectedCustomerId);
      if (!cust) return;
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
          address: cust.address || "Main Street",
          city: cust.city || "Indore",
          state: cust.state || "Madhya Pradesh",
          pinCode: cust.pinCode || "452001",
          phone: cust.phone || "0000000000",
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
      const payloadData = {
        type: formDocType,
        ...customerPayload,
        items: formItems,
        amount: formGrandTotal,
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
    setSelectedCustomerId(inv.customerId || "");
    setCustomerMode("existing");

    const matchedCust = customers.find(c => c._id === inv.customerId);
    const custType = matchedCust?.customerTypes?.[0] || (inv.customerGstin ? "B2B" : "B2C");
    setFormCustomerType(custType as any);

    // Convert saved items to form items format
    const mappedItems = inv.items.map((item: any) => ({
      id: `${item.productId}-${item.selectedVariants["Color"] || ""}-${item.selectedVariants["Size"] || ""}-${item.selectedVariants["Weight"] || ""}`,
      productId: item.productId,
      product: item.product,
      selectedVariants: item.selectedVariants,
      quantity: item.quantity,
      pricePerUnit: item.pricePerUnit
    }));
    setFormItems(mappedItems);
    setInvoiceNotes(inv.notes || "");
    setSalesperson(inv.salesperson || "");
    setIsCreateModalOpen(true);
  };

  const handleVoidInvoice = (id: string) => {
    const docLabel = activeTab === "invoice" ? "Invoice" : activeTab === "receipt" ? "Receipt" : "Quote";
    confirmAction({
      title: `Delete B2B ${docLabel}`,
      message: `Are you sure you want to delete this B2B ${docLabel}? This action cannot be undone.`,
      confirmText: "Yes, Delete Document",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await voidInvoice(id);
          addToast("Document has been deleted successfully.", "success");
          loadData();
        } catch (err: any) {
          addToast(err.message || "Failed to delete document", "error");
        }
      }
    });
  };

  const handleDeleteInvoice = (id: string) => {
    const docLabel = activeTab === "quote" ? "Quote" : "Receipt";
    confirmAction({
      title: `Delete B2B ${docLabel}`,
      message: `Are you sure you want to permanently delete this ${docLabel}? This action is irreversible.`,
      confirmText: "Yes, Delete Permanent",
      cancelText: "Cancel",
      type: "danger",
      onConfirm: async () => {
        try {
          await deleteInvoice(id);
          addToast(`${docLabel} deleted successfully.`, "success");
          setSelectedInvoice(null);
          loadData();
        } catch (err: any) {
          addToast(err.message || `Failed to delete ${docLabel.toLowerCase()}`, "error");
        }
      }
    });
  };

  const handleArchiveInvoice = (id: string) => {
    confirmAction({
      title: "Archive B2B Invoice",
      message: "Are you sure you want to archive this commercial invoice? It will be hidden from the active list.",
      confirmText: "Yes, Archive",
      cancelText: "Cancel",
      type: "warning",
      onConfirm: async () => {
        try {
          await updateInvoice(id, { status: "archived" });
          addToast("Invoice archived successfully.", "success");
          setSelectedInvoice(null);
          loadData();
        } catch (err: any) {
          addToast(err.message || "Failed to archive invoice", "error");
        }
      }
    });
  };

  const handleMarkAsPaid = async () => {
    if (!payInvoiceId) return;
    if (paymentType === "online" && !txnId.trim()) {
      addToast("Please enter a Transaction ID for online payment.", "warning");
      return;
    }

    try {
      const finalMethod = paymentType === "cash" ? "COD" : onlineMethod;
      const finalTxnId = paymentType === "cash" ? "" : txnId.trim();

      await updateInvoice(payInvoiceId, {
        status: "paid",
        paymentMethod: finalMethod,
        transactionId: finalTxnId
      });

      addToast("Document marked as Paid successfully.", "success");
      setSelectedInvoice(prev => prev ? {
        ...prev,
        status: "paid",
        paymentMethod: finalMethod,
        transactionId: finalTxnId,
        type: "invoice"
      } : null);
      setIsPayModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || "Failed to update status to paid", "error");
    }
  };

  return (
    <div className="space-y-6 text-foreground">
      {/* ─── TITLE & TABS ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice & Receipt Manager</h1>
          <p className="text-muted-foreground mt-1"> Persist, monitor, and print commercial invoices, payment receipts, and price quotes.</p>
        </div>
        <Button onClick={() => { setEditInvoiceId(null); setProductSearch(""); setIsCreateModalOpen(true); }} className="flex items-center gap-1.5 font-semibold">
          <Plus className="h-4.5 w-4.5" /> Generate Document
        </Button>
      </div>

      {/* Short Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {activeTab === "quote" ? "Total Quotes" : activeTab === "receipt" ? "Total Receipts" : "Total Invoices"}
              </p>
              <h3 className="text-lg font-black mt-1 text-foreground">{invoices.length}</h3>
            </div>
            <div className="p-2 rounded-lg bg-primary/5 text-primary text-base">
              📄
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Value</p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {formatPrice(invoices.reduce((sum, i) => sum + i.amount, 0))}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 text-green-600 dark:text-green-400 text-base">
              💰
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {activeTab === "quote" ? "Converted" : activeTab === "receipt" ? "Paid Receipts" : "Paid Invoices"}
              </p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {activeTab === "quote" 
                  ? invoices.filter(i => i.status === "converted").length
                  : invoices.filter(i => i.status === "paid").length}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-green-500/5 text-green-600 dark:text-green-400 text-base">
              ✅
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-background to-secondary/10 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {activeTab === "quote" ? "Active Quotes" : activeTab === "receipt" ? "Pending/Failed" : "Void / Deleted"}
              </p>
              <h3 className="text-lg font-black mt-1 text-foreground">
                {activeTab === "quote"
                  ? invoices.filter(i => ["draft", "sent", "finalized"].includes(i.status)).length
                  : activeTab === "receipt"
                  ? invoices.filter(i => ["pending", "failed"].includes(i.status)).length
                  : invoices.filter(i => i.status === "void").length}
              </h3>
            </div>
            <div className="p-2 rounded-lg bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 text-base">
              ⚠️
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/80">
        <button
          onClick={() => { setActiveTab("quote"); setCurrentPage(1); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "quote"
            ? "border-primary text-primary font-bold bg-primary/5"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <FileText className="h-4 w-4" /> Price Quotes
        </button>
        <button
          onClick={() => { setActiveTab("receipt"); setCurrentPage(1); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "receipt"
            ? "border-primary text-primary font-bold bg-primary/5"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <Check className="h-4 w-4" /> Payment Receipts (Failed/Draft)
        </button>
        <button
          onClick={() => { setActiveTab("invoice"); setCurrentPage(1); }}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${activeTab === "invoice"
            ? "border-primary text-primary font-bold bg-primary/5"
            : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          <FileText className="h-4 w-4" /> Commercial Invoices
        </button>
      </div>

      {activeTab !== "quote" && (
        <div className="flex gap-2 border-b border-border/40 py-2 bg-secondary/10 px-4 rounded-lg">
          <button
            onClick={() => setActiveSubTab("B2B")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeSubTab === "B2B"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
          >
            💼 B2B Business {activeTab === "invoice" ? "Invoices" : "Receipts"}
          </button>
          <button
            onClick={() => setActiveSubTab("B2C")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeSubTab === "B2C"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
          >
            🛍️ B2C Retail {activeTab === "invoice" ? "Invoices" : "Receipts"}
          </button>
          <button
            onClick={() => setActiveSubTab("Dropshipping")}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${activeSubTab === "Dropshipping"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
          >
            📦 Dropshipping
          </button>
        </div>
      )}

      <div>
        {/* ─── INVOICE LIST TABLE ─── */}
        <div className="w-full">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 border-b">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${activeTab === "invoice" ? "invoices" : activeTab === "receipt" ? "receipts" : "quotes"}...`}
                  className="pl-9 text-foreground text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-background text-foreground text-xs font-semibold px-3 py-2 border rounded-md"
                >
                  <option value="">All Statuses</option>
                  {activeTab === "quote" && (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="converted">Converted</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                  {activeTab === "receipt" && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                    </>
                  )}
                  {activeTab === "invoice" && (
                    <>
                      <option value="paid">Paid</option>
                      <option value="void">Deleted</option>
                      <option value="archived">Archived</option>
                    </>
                  )}
                </select>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    className="h-8 py-0 px-2 text-xs w-28"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="date"
                    className="h-8 py-0 px-2 text-xs w-28"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-secondary/15 text-muted-foreground uppercase font-bold tracking-wider text-[10px]">
                      <th className="p-4">Doc Number</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4 text-right">Amount</th>
                      <th className="p-4">Payment Method</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                          <span>Fetching records from DB...</span>
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                          No {activeTab === "invoice" ? "invoices" : activeTab === "receipt" ? "receipts" : "price quotes"} found matching the query.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv._id} className="border-b hover:bg-secondary/10 transition-colors">
                          <td className="p-4 font-mono font-bold">{inv._id}</td>
                          <td className="p-4">
                            <p className="font-semibold text-foreground">{inv.customerName}</p>
                            <p className="text-[10px] text-muted-foreground">{inv.customerEmail}</p>
                          </td>
                          <td className="p-4 text-right font-bold text-foreground">{formatPrice(inv.amount)}</td>
                          <td className="p-4 font-medium text-foreground">{inv.paymentMethod || "N/A"}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${inv.status === "void" || inv.status === "failed" || inv.status === "rejected" || inv.status === "expired" ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400" :
                              inv.status === "paid" || inv.status === "accepted" || inv.status === "converted" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400" :
                                inv.status === "pending" || inv.status === "draft" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400" :
                                  "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-400"
                              }`}>
                              {inv.status === "void" ? "deleted" : inv.status}
                            </span>
                          </td>
                          <td className="p-4 font-semibold text-muted-foreground">{inv.generatedAt}</td>
                          <td className="p-4 text-center flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-7 p-0 cursor-pointer"
                              title="View Document"
                              onClick={() => setSelectedInvoice(inv)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {inv.type === "invoice" ? (
                              <>
                                {inv.status !== "archived" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-amber-500 hover:bg-amber-500/10 border-amber-500/20 cursor-pointer"
                                    title="Archive Invoice"
                                    onClick={() => handleArchiveInvoice(inv._id)}
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {inv.status !== "void" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20 cursor-pointer"
                                    title="Delete Invoice"
                                    onClick={() => handleVoidInvoice(inv._id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            ) : inv.type === "quote" ? (
                              <>
                                {inv.status !== "converted" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-primary hover:bg-primary/10 border-primary/20 cursor-pointer"
                                      title="Edit Quote"
                                      onClick={() => handleEditQuote(inv)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20 cursor-pointer"
                                      title="Delete Quote"
                                      onClick={() => handleDeleteInvoice(inv._id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {inv.status !== "paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 border-destructive/20 cursor-pointer"
                                    title="Delete Receipt"
                                    onClick={() => handleDeleteInvoice(inv._id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="p-4 border-t flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Showing page {page} of {totalPages}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* ─── CREATE DOCUMENT MODAL ─── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <div className="p-6 border-b sticky top-0 bg-background z-10 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  Generate New {formDocType === "invoice" ? "Invoice" : formDocType === "receipt" ? "Receipt" : "Price Quote"}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Input billing, product items, and payment details to build a sequential record.</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsCreateModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSaveInvoice} className="p-6 space-y-6">
              {/* Type and Mode Selectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-secondary/10 p-4 rounded-lg border border-border/80">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Document Type</label>
                  <select
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value as any)}
                    className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md font-bold cursor-pointer"
                  >
                    <option value="invoice">Tax Invoice</option>
                    <option value="receipt">Payment Receipt</option>
                    <option value="quote">Price Quote</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">Client Ordering Mode (Customer Type)</label>
                  <select
                    value={formCustomerType}
                    onChange={(e) => {
                      setFormCustomerType(e.target.value as any);
                      setSelectedCustomerId("");
                    }}
                    className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md font-bold cursor-pointer"
                  >
                    <option value="B2C">B2C (Retail)</option>
                    <option value="B2B">B2B (Wholesale Bulk)</option>
                    <option value="Dropshipping">Dropshipping</option>
                  </select>
                </div>
              </div>

              {/* Customer selection */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-b pb-1.5">1. {formCustomerType} Client Details</h3>
                <div className="flex border-b border-border/60 max-w-xs">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("existing")}
                    className={`flex-1 py-1.5 text-xs font-semibold text-center border-b-2 cursor-pointer ${customerMode === "existing" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
                      }`}
                  >
                    Registered Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("new")}
                    className={`flex-1 py-1.5 text-xs font-semibold text-center border-b-2 cursor-pointer ${customerMode === "new" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
                      }`}
                  >
                    New Client (Auto-Create)
                  </button>
                </div>

                {customerMode === "existing" ? (
                  <div className="max-w-md">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Buyer</label>
                    <CustomerSearchPicker
                      selectedCustomer={customers.find(c => c._id === selectedCustomerId) || null}
                      onSelect={(c) => setSelectedCustomerId(c ? c._id : "")}
                      placeholder={`Type to search registered ${formCustomerType} client...`}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Full Name *</label>
                      <Input
                        required
                        value={newCustName}
                        onChange={(e) => setNewCustName(e.target.value)}
                        placeholder="John Doe"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address *</label>
                      <Input
                        required
                        type="email"
                        value={newCustEmail}
                        onChange={(e) => setNewCustEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone Number *</label>
                      <Input
                        required
                        value={newCustPhone}
                        onChange={(e) => setNewCustPhone(e.target.value)}
                        placeholder="9876543210"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        Company / Organization{formCustomerType === "B2B" && " *"}
                      </label>
                      <Input
                        required={formCustomerType === "B2B"}
                        value={newCustCompany}
                        onChange={(e) => setNewCustCompany(e.target.value)}
                        placeholder="XYZ Solutions Ltd"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">
                        GSTIN{formCustomerType === "B2B" && " *"}
                      </label>
                      <Input
                        required={formCustomerType === "B2B"}
                        value={newCustGstin}
                        onChange={(e) => setNewCustGstin(e.target.value)}
                        placeholder="24AAACF1001M1Z5"
                        className="text-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Shipping State *</label>
                      <select
                        value={newCustState}
                        onChange={(e) => setNewCustState(e.target.value)}
                        className="bg-background text-foreground text-sm w-full px-3 py-2.5 border rounded-md"
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Address *</label>
                      <Input
                        required
                        value={newCustAddress}
                        onChange={(e) => setNewCustAddress(e.target.value)}
                        placeholder="2nd Floor, Sector B, Plot 3"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">City *</label>
                      <Input
                        required
                        value={newCustCity}
                        onChange={(e) => setNewCustCity(e.target.value)}
                        placeholder="Surat"
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Pin Code *</label>
                      <Input
                        required
                        value={newCustPinCode}
                        onChange={(e) => setNewCustPinCode(e.target.value)}
                        placeholder="395001"
                        className="text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-b pb-1.5">2. Add Product Items</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-secondary/10 p-4 rounded-lg border">
                  <div className="relative md:col-span-2" ref={productWrapperRef}>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Search Product *</label>
                    <div className="relative">
                      <Input
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          setIsProductDropdownOpen(true);
                        }}
                        onFocus={() => setIsProductDropdownOpen(true)}
                        placeholder="Search product name, ID, HSN..."
                        className="text-sm font-semibold pr-8 text-foreground"
                      />
                      {selectedProductId && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductId("");
                            setProductSearch("");
                          }}
                          className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {isProductDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProductsForSelect.length > 0 ? (
                          filteredProductsForSelect.map((p) => {
                            const firstVariant = p.colorVariants?.[0]?.subVariants?.[0];
                            const price = firstVariant ? resolvePrice(firstVariant, formCustomerType) : 0;
                            const moq = firstVariant ? resolveMoq(firstVariant, formCustomerType as any) : 1;
                            const qFilter = productSearch.toLowerCase().trim();
                            const matchedSkuObj = p.colorVariants?.flatMap(cv => cv.subVariants || []).find(sv => sv.sku && sv.sku.toLowerCase().includes(qFilter));
                            const sku = matchedSkuObj?.sku || firstVariant?.sku || "N/A";
                            return (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => {
                                  setSelectedProductId(p._id);
                                  setProductSearch(p.title);
                                  setIsProductDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-xs hover:bg-secondary/35 flex flex-col border-b border-border/40 last:border-b-0 transition-colors ${selectedProductId === p._id ? "bg-primary/5 font-bold" : ""
                                  }`}
                              >
                                <div className="flex justify-between items-center w-full">
                                  <span className="font-semibold text-foreground">{p.title}</span>
                                  <span className="text-[10px] text-primary font-mono">{p._id}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5 flex justify-between w-full">
                                  <span>Stock: {p.totalStock} | HSN: {p.hsnCode || "N/A"} | SKU: {sku}</span>
                                  <span className="font-medium text-foreground">Base Price: ₹{price} (MOQ: {moq})</span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-3 text-xs text-muted-foreground text-center">
                            No matching products found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {currentSelectedProduct && (
                    <>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Color Option</label>
                        <select
                          value={selectedColor}
                          onChange={(e) => setSelectedColor(e.target.value)}
                          className="bg-background text-foreground text-sm w-full px-3 py-2.5 border rounded-md"
                        >
                          <option value="">-- Choose Color --</option>
                          {availableColors.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {availableSizes.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Size Option</label>
                          <select
                            value={selectedSize}
                            onChange={(e) => setSelectedSize(e.target.value)}
                            className="bg-background text-foreground text-sm w-full px-3 py-2.5 border rounded-md"
                          >
                            <option value="">-- Choose Size --</option>
                            {availableSizes.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {availableWeights.length > 0 && (
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Weight Option</label>
                          <select
                            value={selectedWeight}
                            onChange={(e) => setSelectedWeight(e.target.value)}
                            className="bg-background text-foreground text-sm w-full px-3 py-2.5 border rounded-md"
                          >
                            <option value="">-- Choose Weight --</option>
                            {availableWeights.map(w => (
                              <option key={w} value={w}>{w}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Price per Unit (Overridable)</label>
                        <Input
                          type="number"
                          value={itemPrice || ""}
                          onChange={(e) => setItemPrice(parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Order Qty</label>
                        <Input
                          type="number"
                          min="1"
                          value={itemQty}
                          onChange={(e) => setItemQty(parseInt(e.target.value, 10) || 1)}
                          className="text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <Button type="button" onClick={handleAddItem} className="w-full">
                          Add Item Option
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Items Summary List */}
                {formItems.length > 0 && (
                  <div className="border border-border/80 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b bg-secondary/15 font-bold uppercase tracking-wider text-[10px] text-muted-foreground">
                          <th className="p-3">Product Description</th>
                          <th className="p-3 text-center">HSN</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Price Per Unit</th>
                          <th className="p-3 text-center">GST Rate</th>
                          <th className="p-3 text-right">Subtotal</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((item) => {
                          const formattedVariants = Object.entries(item.selectedVariants)
                            .map(([key, val]) => `${key}: ${val}`)
                            .join(" • ");
                          return (
                            <tr key={item.id} className="border-b hover:bg-secondary/5">
                              <td className="p-3">
                                <p className="font-semibold text-foreground">{item.product.title}</p>
                                <p className="text-[10px] text-muted-foreground">{formattedVariants}</p>
                              </td>
                              <td className="p-3 text-center font-mono">{item.product.hsnCode}</td>
                              <td className="p-3 text-center font-bold">{item.quantity}</td>
                              <td className="p-3 text-right font-semibold">₹{item.pricePerUnit.toFixed(2)}</td>
                              <td className="p-3 text-center font-medium">{item.product.gstRate}%</td>
                              <td className="p-3 text-right font-bold text-foreground">
                                ₹{(item.pricePerUnit * item.quantity).toFixed(2)}
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  type="button"
                                  className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payment Details & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-b pb-1.5">3. Commercial Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {formDocType !== "quote" && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
                          >
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Razorpay">Online (Razorpay)</option>
                            <option value="UPI">UPI</option>
                            <option value="COD">Cash on Delivery (COD)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Status</label>
                          <select
                            value={formDocType === "invoice" ? "Paid" : paymentStatus}
                            disabled={formDocType === "invoice"}
                            onChange={(e) => setPaymentStatus(e.target.value)}
                            className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md disabled:opacity-75"
                          >
                            <option value="Paid">Paid (Completed)</option>
                            <option value="Pending">Pending (COD/Transfer)</option>
                            <option value="Failed">Failed (Log Failure)</option>
                          </select>
                        </div>
                        {(formDocType === "invoice" || paymentStatus === "Paid") && (
                          <div className="col-span-2">
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">Transaction Ref / Reference ID *</label>
                            <Input
                              value={transactionId}
                              onChange={(e) => setTransactionId(e.target.value)}
                              placeholder="e.g. pay_N1oH5mC17842"
                              required
                              className="text-sm font-mono"
                            />
                          </div>
                        )}
                      </>
                    )}
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Salesperson Name</label>
                      <Input
                        value={salesperson}
                        onChange={(e) => setSalesperson(e.target.value)}
                        placeholder="e.g. Vikram Singh"
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Tax Breakdown Preview */}
                <div className="bg-secondary/15 p-4 rounded-lg border space-y-3 text-xs">
                  <h4 className="font-bold text-[10px] text-muted-foreground uppercase tracking-widest border-b pb-1">
                    GST & Cost Computation Preview
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxable Value:</span>
                      <span className="font-semibold">₹{formTaxBreakdown.baseSubtotal.toFixed(2)}</span>
                    </div>
                    {formTaxBreakdown.isIntrastate ? (
                      <>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>CGST (Central Tax):</span>
                          <span>₹{formTaxBreakdown.cgst.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>SGST (State Tax):</span>
                          <span>₹{formTaxBreakdown.sgst.toFixed(2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>IGST (Integrated Tax):</span>
                        <span>₹{formTaxBreakdown.igst.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground border-t border-border/40 pt-1">
                      <span>Items Total (Incl. GST):</span>
                      <span>₹{formItemsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground border-t border-border/40 pt-1">
                      <span>Shipping & Handling ({formCustomerType}):</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formShippingCharge > 0 ? `₹${formShippingCharge.toFixed(2)}` : "Free"}
                      </span>
                    </div>
                    {formTotalWeight > 0 && formCustomerType !== "B2B" && (
                      <div className="text-[10px] text-right text-muted-foreground -mt-1 font-mono">
                        Package weight: {formTotalWeight}g
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 font-bold text-sm text-foreground">
                      <span>Grand Total:</span>
                      <span className="text-primary text-base">₹{formGrandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Admin Notes (Will appear on print)</label>
                  <textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Add shipping references, discount adjustments or terms override..."
                    className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md h-20"
                  />
                </div>
              </div>

              {/* Form submit */}
              <div className="flex justify-end gap-3 border-t pt-4">
                <Button variant="outline" type="button" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="font-semibold">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Save & Issue Document"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── PAYMENT DETAILS / MARK PAID MODAL ─── */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border rounded-xl max-w-md w-full shadow-2xl p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-foreground">Receive Payment</h3>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsPayModalOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Mark document <span className="font-mono font-bold text-foreground">{payInvoiceId}</span> as Paid.
              This will convert the receipt to a Tax Invoice and sync payment details onto the linked order.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentType("cash")}
                    className={`p-3 border rounded-lg text-left transition-all ${paymentType === "cash"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-secondary/5 text-muted-foreground"
                      }`}
                  >
                    <div className="font-bold text-xs">Cash / COD</div>
                    <div className="text-[10px] opacity-80 mt-0.5">Physical cash collected</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("online")}
                    className={`p-3 border rounded-lg text-left transition-all ${paymentType === "online"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-secondary/5 text-muted-foreground"
                      }`}
                  >
                    <div className="font-bold text-xs">Online Payment</div>
                    <div className="text-[10px] opacity-80 mt-0.5">UPI, Cards, Netbanking</div>
                  </button>
                </div>
              </div>

              {paymentType === "online" && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Online Method</label>
                    <select
                      value={onlineMethod}
                      onChange={(e) => setOnlineMethod(e.target.value as any)}
                      className="text-xs w-full bg-background border rounded px-2.5 py-1.5 focus:outline-none font-semibold text-foreground"
                    >
                      <option value="UPI">UPI / Instant Transfer</option>
                      <option value="Razorpay">Razorpay Gateway</option>
                      <option value="Bank Transfer">Direct Bank Transfer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Transaction ID / Reference #</label>
                    <Input
                      type="text"
                      value={txnId}
                      onChange={(e) => setTxnId(e.target.value)}
                      placeholder="e.g. UPI Ref # or Bank Txn ID"
                      className="text-xs font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t pt-4 mt-6">
              <Button variant="outline" size="sm" type="button" onClick={() => setIsPayModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleMarkAsPaid} className="font-semibold">
                Confirm & Mark Paid
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ─── DOCUMENT PREVIEW DIALOG (A4 FORMAT) ─── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
            }
          `}</style>
          <div className="bg-background border rounded-xl max-w-4xl w-full shadow-2xl relative flex flex-col my-8">
            {/* Modal Header */}
            <div className="p-4 border-b sticky top-0 bg-background z-10 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Document Preview: <span className="font-mono text-primary">{selectedInvoice._id}</span>
                </h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  View, print, or manage status details of this document in standard A4 structure.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Status select dropdown */}
                <select
                  value={selectedInvoice.status}
                  disabled={selectedInvoice.status === "converted"}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    if (newStatus === "paid") {
                      setPayInvoiceId(selectedInvoice._id);
                      setPayInvoiceType(selectedInvoice.type);
                      setPaymentType("cash");
                      setOnlineMethod("UPI");
                      setTxnId("");
                      setIsPayModalOpen(true);
                    } else {
                      (async () => {
                        try {
                          await updateInvoice(selectedInvoice._id, { status: newStatus as any });
                          addToast(`Document status updated to ${newStatus}.`, "success");
                          setSelectedInvoice(prev => prev ? { ...prev, status: newStatus as any } : null);
                          loadData();
                        } catch (err: any) {
                          addToast(err.message || "Failed to update status", "error");
                        }
                      })();
                    }
                  }}
                  className="text-xs bg-background border rounded px-2.5 py-1.5 font-semibold focus:outline-none cursor-pointer"
                >
                  {selectedInvoice.type === "quote" && (
                    <>
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="converted" disabled>Converted</option>
                      <option value="cancelled">Cancelled</option>
                    </>
                  )}
                  {selectedInvoice.type === "receipt" && (
                    <>
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="failed">Failed</option>
                    </>
                  )}
                  {selectedInvoice.type === "invoice" && (
                    <>
                      <option value="paid">Paid</option>
                      <option value="void">Deleted</option>
                      <option value="archived">Archived</option>
                    </>
                  )}
                </select>

                <Button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer px-3 py-1.5 h-8.5"
                >
                  <Printer className="h-4 w-4" /> Print / Save PDF
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                  className="h-8.5 w-8.5 p-0 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Modal Body / A4 Container */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-neutral-100 dark:bg-neutral-900 flex justify-center max-h-[75vh] w-full">
              <div className="print-container bg-white dark:bg-zinc-950 shadow-md border border-border w-full max-w-[800px] p-6 sm:p-10 md:p-14 rounded-sm select-text flex flex-col justify-between">
                <InvoiceDocument
                  type={selectedInvoice.type}
                  documentNumber={selectedInvoice._id}
                  customerId={selectedInvoice.customerId}
                  order={{
                    _id: selectedInvoice.orderId || "",
                    date: selectedInvoice.generatedAt,
                    amount: selectedInvoice.amount,
                    status: "Processing",
                    statusClass: "",
                    itemsCount: selectedInvoice.items.reduce((acc, item) => acc + item.quantity, 0),
                    customerName: selectedInvoice.customerName,
                    shippingAddress: selectedInvoice.shippingAddress,
                    items: selectedInvoice.items,
                    history: [],
                    paymentMethod: selectedInvoice.paymentMethod as any,
                    paymentStatus: selectedInvoice.paymentStatus as any,
                    transactionId: selectedInvoice.transactionId,
                    couponCode: selectedInvoice.couponCode,
                    couponDiscount: selectedInvoice.couponDiscount,
                  }}
                  sellerInfo={selectedInvoice.sellerInfo}
                  taxBreakdown={selectedInvoice.taxDetails}
                  showActions={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
