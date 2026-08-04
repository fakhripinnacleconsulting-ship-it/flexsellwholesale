import React from "react";
import { Customer, Invoice, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";
import { customerService } from "@/services/customerService";
import { shippingService } from "@/services/shippingService";
import { useInvoiceStore } from "@/stores/invoiceStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";

interface UseInvoiceFormOptions {
  onSuccess?: () => void;
}

export function useInvoiceForm(options?: UseInvoiceFormOptions) {
  const { createInvoice, updateInvoice } = useInvoiceStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();

  const [shippingConfig, setShippingConfig] = React.useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [formDocType, setFormDocType] = React.useState<"invoice" | "receipt" | "quote">("invoice");
  const [formCustomerType, setFormCustomerType] = React.useState<"B2B" | "B2C" | "Dropshipping">("B2B");
  const [customers, setCustomers] = React.useState<Customer[]>([]);

  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">("existing");
  const [selectedCustomerId, setSelectedCustomerId] = React.useState("");

  const [newCustName, setNewCustName] = React.useState("");
  const [newCustEmail, setNewCustEmail] = React.useState("");
  const [newCustPhone, setNewCustPhone] = React.useState("");
  const [newCustCompany, setNewCustCompany] = React.useState("");
  const [newCustGstin, setNewCustGstin] = React.useState("");
  const [newCustAddress, setNewCustAddress] = React.useState("");
  const [newCustCity, setNewCustCity] = React.useState("");
  const [newCustState, setNewCustState] = React.useState(INDIAN_STATES[0]);
  const [newCustPinCode, setNewCustPinCode] = React.useState("");

  const [formItems, setFormItems] = React.useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = React.useState("");
  const [selectedColor, setSelectedColor] = React.useState("");
  const [selectedSize, setSelectedSize] = React.useState("");
  const [selectedWeight, setSelectedWeight] = React.useState("");
  const [itemQty, setItemQty] = React.useState(1);
  const [itemPrice, setItemPrice] = React.useState(0);

  const [paymentMethod, setPaymentMethod] = React.useState("Bank Transfer");
  const [paymentStatus, setPaymentStatus] = React.useState("Paid");
  const [transactionId, setTransactionId] = React.useState("");
  const [invoiceNotes, setInvoiceNotes] = React.useState("");
  const [salesperson, setSalesperson] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [editInvoiceId, setEditInvoiceId] = React.useState<string | null>(null);
  const [productSearch, setProductSearch] = React.useState("");

  const [isOrderCreationMode, setIsOrderCreationMode] = React.useState(false);
  const [includeDropshipDetails, setIncludeDropshipDetails] = React.useState(true);
  const [dropshipDetails, setDropshipDetails] = React.useState<any>({});

  React.useEffect(() => {
    shippingService.getConfig()
      .then((cfg: any) => setShippingConfig(cfg))
      .catch((err: any) => console.error("Failed to load shipping config:", err));
  }, []);

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

  React.useEffect(() => {
    if (isCreateModalOpen) {
      initializeProducts();
      customerService.getCustomers()
        .then(setCustomers)
        .catch(err => console.error("Failed to load customers:", err));
    }
  }, [isCreateModalOpen, initializeProducts]);

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
        customerType: formCustomerType,
        dropshipDetails: (formCustomerType === "Dropshipping" && includeDropshipDetails) ? dropshipDetails : undefined
      };

      if (editInvoiceId) {
        await updateInvoice(editInvoiceId, payloadData as any);
        addToast("Document updated successfully!", "success");
      } else {
        await createInvoice(payloadData as any);
        const docLabel = formDocType === "invoice" ? "Invoice" : formDocType === "receipt" ? "Receipt" : "Price Quote";
        addToast(`${docLabel} generated successfully!`, "success");
      }
      setIsCreateModalOpen(false);
      setEditInvoiceId(null);
      setProductSearch("");

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
      setDropshipDetails({});
      setIncludeDropshipDetails(true);

      if (options?.onSuccess) {
        options.onSuccess();
      }
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

  return {
    isCreateModalOpen,
    setIsCreateModalOpen,
    formDocType,
    setFormDocType,
    formCustomerType,
    setFormCustomerType,
    customerMode,
    setCustomerMode,
    selectedCustomerId,
    setSelectedCustomerId,
    newCustName,
    setNewCustName,
    newCustEmail,
    setNewCustEmail,
    newCustPhone,
    setNewCustPhone,
    newCustCompany,
    setNewCustCompany,
    newCustGstin,
    setNewCustGstin,
    newCustAddress,
    setNewCustAddress,
    newCustCity,
    setNewCustCity,
    newCustState,
    setNewCustState,
    newCustPinCode,
    setNewCustPinCode,
    formItems,
    setFormItems,
    selectedProductId,
    setSelectedProductId,
    selectedColor,
    setSelectedColor,
    selectedSize,
    setSelectedSize,
    selectedWeight,
    setSelectedWeight,
    itemQty,
    setItemQty,
    itemPrice,
    setItemPrice,
    paymentMethod,
    setPaymentMethod,
    paymentStatus,
    setPaymentStatus,
    transactionId,
    setTransactionId,
    salesperson,
    setSalesperson,
    invoiceNotes,
    setInvoiceNotes,
    isSubmitting,
    setIsSubmitting,
    editInvoiceId,
    setEditInvoiceId,
    productSearch,
    setProductSearch,
    isOrderCreationMode,
    setIsOrderCreationMode,
    includeDropshipDetails,
    setIncludeDropshipDetails,
    dropshipDetails,
    setDropshipDetails,
    customers,
    products,
    shippingConfig,
    handleSaveInvoice,
    handleEditQuote,
    addToast
  };
}
