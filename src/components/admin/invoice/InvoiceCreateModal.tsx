"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { X, Plus, Trash2, Loader2, QrCode } from "lucide-react";
import { Customer, Product, TaxBreakdown } from "@/types";
import { INDIAN_STATES } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import { resolvePrice, resolveMoq } from "@/lib/priceTierHelper";
import CustomerSearchPicker from "@/components/admin/CustomerSearchPicker";
import { BarcodeScanner } from "@/components/admin/BarcodeScanner";

interface InvoiceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editInvoiceId: string | null;
  formDocType: "invoice" | "receipt" | "quote";
  setFormDocType: (type: "invoice" | "receipt" | "quote") => void;
  formCustomerType: "B2B" | "B2C" | "Dropshipping";
  setFormCustomerType: (type: "B2B" | "B2C" | "Dropshipping") => void;
  customers: Customer[];
  customerMode: "existing" | "new";
  setCustomerMode: (mode: "existing" | "new") => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  newCustName: string;
  setNewCustName: (val: string) => void;
  newCustEmail: string;
  setNewCustEmail: (val: string) => void;
  newCustPhone: string;
  setNewCustPhone: (val: string) => void;
  newCustCompany: string;
  setNewCustCompany: (val: string) => void;
  newCustGstin: string;
  setNewCustGstin: (val: string) => void;
  newCustAddress: string;
  setNewCustAddress: (val: string) => void;
  newCustCity: string;
  setNewCustCity: (val: string) => void;
  newCustState: string;
  setNewCustState: (val: string) => void;
  newCustPinCode: string;
  setNewCustPinCode: (val: string) => void;
  products: Product[];
  formItems: any[];
  setFormItems: React.Dispatch<React.SetStateAction<any[]>>;
  selectedProductId: string;
  setSelectedProductId: (id: string) => void;
  productSearch: string;
  setProductSearch: (val: string) => void;
  selectedColor: string;
  setSelectedColor: (val: string) => void;
  selectedSize: string;
  setSelectedSize: (val: string) => void;
  selectedWeight: string;
  setSelectedWeight: (val: string) => void;
  itemQty: number;
  setItemQty: (qty: number) => void;
  itemPrice: number;
  setItemPrice: (price: number) => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  paymentStatus: string;
  setPaymentStatus: (status: string) => void;
  transactionId: string;
  setTransactionId: (id: string) => void;
  salesperson: string;
  setSalesperson: (name: string) => void;
  invoiceNotes: string;
  setInvoiceNotes: (notes: string) => void;
  isSubmitting: boolean;
  onSaveInvoice: (e: React.FormEvent) => void;
  addToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  shippingConfig?: any;
}

export function InvoiceCreateModal({
  isOpen,
  onClose,
  editInvoiceId,
  formDocType,
  setFormDocType,
  formCustomerType,
  setFormCustomerType,
  customers,
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
  products,
  formItems,
  setFormItems,
  selectedProductId,
  setSelectedProductId,
  productSearch,
  setProductSearch,
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
  onSaveInvoice,
  addToast,
  shippingConfig,
}: InvoiceCreateModalProps) {
  const calculatedShipping = React.useMemo(() => {
    if (!shippingConfig || !formItems || formItems.length === 0) return 0;
    try {
      const { calculateTotalShippingCharge } = require("@/lib/shippingHelper");
      const { calculateShippingByWeight, calculateEffectiveUnitWeightGrams } = require("@/lib/priceTierHelper");

      const itemsWithTier = formItems.map(item => ({
        ...item,
        priceTier: formCustomerType
      }));

      return calculateTotalShippingCharge(
        itemsWithTier,
        shippingConfig,
        calculateShippingByWeight,
        calculateEffectiveUnitWeightGrams
      );
    } catch (e) {
      console.error("Failed to calculate shipping in modal:", e);
      return 0;
    }
  }, [formItems, formCustomerType, shippingConfig]);
  const [isInvoiceScannerOpen, setIsInvoiceScannerOpen] = React.useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = React.useState(false);
  const productWrapperRef = React.useRef<HTMLDivElement>(null);

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
  }, [products, selectedProductId, setProductSearch]);

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

  const currentProduct = React.useMemo(() => {
    return products.find(p => p._id === selectedProductId) || null;
  }, [products, selectedProductId]);

  const availableColors = React.useMemo(() => {
    if (!currentProduct?.colorVariants) return [];
    return currentProduct.colorVariants.map(cv => cv.color);
  }, [currentProduct]);

  const availableSizes = React.useMemo(() => {
    if (!currentProduct || !selectedColor) return [];
    const cv = currentProduct.colorVariants?.find(c => c.color === selectedColor);
    if (!cv?.subVariants) return [];
    return Array.from(new Set(cv.subVariants.map(sv => sv.size).filter(Boolean)));
  }, [currentProduct, selectedColor]);

  const availableWeights = React.useMemo(() => {
    if (!currentProduct || !selectedColor) return [];
    const cv = currentProduct.colorVariants?.find(c => c.color === selectedColor);
    if (!cv?.subVariants) return [];
    return Array.from(new Set(cv.subVariants.map(sv => sv.weight).filter(Boolean)));
  }, [currentProduct, selectedColor]);

  const handleAddItem = () => {
    if (!selectedProductId || !currentProduct) {
      addToast("Please select a valid product first.", "warning");
      return;
    }
    const colorVar = currentProduct.colorVariants?.find(c => c.color === selectedColor) || currentProduct.colorVariants?.[0];
    const subVar = colorVar?.subVariants?.find(sv =>
      (!selectedSize || sv.size === selectedSize) &&
      (!selectedWeight || sv.weight === selectedWeight)
    ) || colorVar?.subVariants?.[0];

    const finalPrice = itemPrice > 0 ? itemPrice : resolvePrice(subVar, formCustomerType);

    const itemWeightStr = selectedWeight || subVar?.weight || "500g";
    const { parseWeightToGrams } = require("@/lib/shippingHelper");
    const parsedWeightGrams = subVar?.weightGrams || (itemWeightStr !== "N/A" ? parseWeightToGrams(itemWeightStr) : 500) || 500;

    const newItem = {
      productId: currentProduct._id,
      productTitle: currentProduct.title,
      product: currentProduct,
      color: selectedColor || colorVar?.color || "Default",
      size: selectedSize || subVar?.size || "Standard",
      weight: itemWeightStr,
      weightGrams: parsedWeightGrams,
      hsnCode: currentProduct.hsnCode || "3924",
      gstRate: currentProduct.gstRate || 18,
      mrp: subVar?.mrp || finalPrice,
      b2cPrice: subVar?.b2cPrice || finalPrice,
      b2bPrice: subVar?.b2bPrice || finalPrice,
      dropshippingPrice: subVar?.dropshippingPrice || finalPrice,
      sku: subVar?.sku || currentProduct._id,
      selectedVariants: {
        color: selectedColor || colorVar?.color || "Default",
        size: selectedSize || subVar?.size || "Standard",
        weight: itemWeightStr
      },
      quantity: itemQty,
      pricePerUnit: finalPrice
    };

    setFormItems(prev => [...prev, newItem]);
    addToast(`Added ${currentProduct.title} to document!`, "success");

    setSelectedProductId("");
    setProductSearch("");
    setSelectedColor("");
    setSelectedSize("");
    setSelectedWeight("");
    setItemQty(1);
    setItemPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  // Compute Tax & Subtotal
  const formTaxBreakdown: TaxBreakdown = React.useMemo(() => {
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

    return {
      isIntrastate,
      baseSubtotal,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      hsnSlabs,
    };
  }, [formItems, newCustState]);

  const formGrandTotal = React.useMemo(() => {
    return formItems.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  }, [formItems]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        <div className="p-6 border-b sticky top-0 bg-background z-10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {editInvoiceId ? "Edit" : "Generate New"} {formDocType === "invoice" ? "Invoice" : formDocType === "receipt" ? "Receipt" : "Price Quote"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Input billing, product items, and payment details to build a sequential record.</p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={onSaveInvoice} className="p-6 space-y-6">
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
                className={`flex-1 py-1.5 text-xs font-semibold text-center border-b-2 cursor-pointer ${
                  customerMode === "existing" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
                }`}
              >
                Registered Client
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`flex-1 py-1.5 text-xs font-semibold text-center border-b-2 cursor-pointer ${
                  customerMode === "new" ? "border-primary text-primary font-bold" : "border-transparent text-muted-foreground"
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
                  <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} required placeholder="e.g. Rahul Sharma" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Email Address *</label>
                  <Input type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} required placeholder="e.g. rahul@company.com" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Phone Number *</label>
                  <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} required placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Company / Business Name</label>
                  <Input value={newCustCompany} onChange={(e) => setNewCustCompany(e.target.value)} placeholder="e.g. Sharma Retail Pvt Ltd" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">GSTIN Number</label>
                  <Input value={newCustGstin} onChange={(e) => setNewCustGstin(e.target.value.toUpperCase())} placeholder="e.g. 23AAACD1234D1Z0" className="font-mono uppercase" />
                </div>
                <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Street Address *</label>
                    <Input value={newCustAddress} onChange={(e) => setNewCustAddress(e.target.value)} required placeholder="Building, Street, Area" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">City *</label>
                    <Input value={newCustCity} onChange={(e) => setNewCustCity(e.target.value)} required placeholder="City" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">State *</label>
                    <select
                      value={newCustState}
                      onChange={(e) => setNewCustState(e.target.value)}
                      className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
                    >
                      {INDIAN_STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Pincode *</label>
                    <Input value={newCustPinCode} onChange={(e) => setNewCustPinCode(e.target.value)} required placeholder="452001" className="font-mono" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Product Items Selection */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-1.5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-primary">2. Line Items ({formCustomerType} Pricing)</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsInvoiceScannerOpen(true)}
                className="text-xs gap-1.5 cursor-pointer font-semibold"
              >
                <QrCode className="h-3.5 w-3.5" /> Scan Barcode
              </Button>
            </div>

            {/* Item Input Row */}
            <div className="bg-secondary/10 p-4 rounded-lg border space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 relative" ref={productWrapperRef}>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">Search & Select Product</label>
                  <Input
                    placeholder="Type title, SKU, HSN or barcode..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setIsProductDropdownOpen(true);
                    }}
                    onFocus={() => setIsProductDropdownOpen(true)}
                    className="text-sm font-semibold"
                  />

                  {isProductDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-popover border text-popover-foreground rounded-md shadow-lg max-h-60 overflow-y-auto z-50">
                      {filteredProductsForSelect.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">No products found matching query.</div>
                      ) : (
                        filteredProductsForSelect.map(p => (
                          <div
                            key={p._id}
                            onClick={() => {
                              setSelectedProductId(p._id);
                              setProductSearch(p.title);
                              setIsProductDropdownOpen(false);
                              setSelectedColor("");
                              setSelectedSize("");
                              setSelectedWeight("");
                            }}
                            className={`p-2.5 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer border-b border-border/40 ${
                              selectedProductId === p._id ? "bg-accent/50 font-bold" : ""
                            }`}
                          >
                            <div className="font-bold">{p.title}</div>
                            <div className="text-[10px] text-muted-foreground flex justify-between mt-0.5 font-mono">
                              <span>ID: {p._id}</span>
                              <span>HSN: {p.hsnCode || "3924"} ({p.gstRate || 18}%)</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {currentProduct && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Variation / Color</label>
                    <select
                      value={selectedColor}
                      onChange={(e) => {
                        setSelectedColor(e.target.value);
                        setSelectedSize("");
                        setSelectedWeight("");
                      }}
                      className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">-- Choose Variation --</option>
                      {availableColors.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {availableSizes.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Pack Sizing</label>
                    <select
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value)}
                      className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
                    >
                      <option value="">-- Choose Pack --</option>
                      {availableSizes.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {currentProduct && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-2 border-t border-border/60">
                  {availableWeights.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Select Weight Option</label>
                      <select
                        value={selectedWeight}
                        onChange={(e) => setSelectedWeight(e.target.value)}
                        className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md"
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
                    <Button type="button" onClick={handleAddItem} className="w-full cursor-pointer font-semibold">
                      <Plus className="h-4 w-4 mr-1" /> Add Line Item
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Added Items Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b bg-secondary/15 font-bold uppercase text-[10px] text-muted-foreground">
                    <th className="p-3">Item Description</th>
                    <th className="p-3 font-mono">HSN / GST</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Price/Unit</th>
                    <th className="p-3 text-right">Gross Total</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {formItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground italic">
                        No items added to document yet. Select product above and click 'Add Line Item'.
                      </td>
                    </tr>
                  ) : (
                    formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-3">
                          <div className="font-bold text-foreground">{item.productTitle}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Varient: {item.color} • Size: {item.size} • SKU: {item.sku}
                          </div>
                        </td>
                        <td className="p-3 font-mono text-[11px]">
                          {item.hsnCode} ({item.gstRate}%)
                        </td>
                        <td className="p-3 text-right font-bold">{item.quantity}</td>
                        <td className="p-3 text-right font-mono">{formatPrice(item.pricePerUnit)}</td>
                        <td className="p-3 text-right font-black">{formatPrice(item.pricePerUnit * item.quantity)}</td>
                        <td className="p-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(idx)}
                            className="h-7 w-7 p-0 text-red-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Salesperson */}
          <div className="space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-b pb-1.5">3. Document Settings & Sales Attribution</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formDocType !== "quote" && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md cursor-pointer font-semibold"
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
                      className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md disabled:opacity-75 font-semibold"
                    >
                      <option value="Paid">Paid (Completed)</option>
                      <option value="Pending">Pending (COD/Transfer)</option>
                      <option value="Failed">Failed (Log Failure)</option>
                    </select>
                  </div>
                  {(formDocType === "invoice" || paymentStatus === "Paid") && (
                    <div className="col-span-1 sm:col-span-2">
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
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Salesperson Name</label>
                <Input
                  value={salesperson}
                  onChange={(e) => setSalesperson(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  className="text-sm"
                />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Admin Notes (Will appear on print)</label>
                <textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Add shipping references, discount adjustments or terms override..."
                  className="bg-background text-foreground text-sm w-full px-3 py-2 border rounded-md h-20"
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
              <div className="flex justify-between text-muted-foreground">
                <span>Taxable Subtotal (Base Value):</span>
                <span className="font-bold font-mono">{formatPrice(formTaxBreakdown.baseSubtotal)}</span>
              </div>
              {formTaxBreakdown.isIntrastate ? (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>CGST (Central GST):</span>
                    <span className="font-mono">{formatPrice(formTaxBreakdown.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>SGST (State GST):</span>
                    <span className="font-mono">{formatPrice(formTaxBreakdown.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-muted-foreground">
                  <span>IGST (Integrated Tax):</span>
                  <span className="font-mono">{formatPrice(formTaxBreakdown.igst)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground pt-1 border-t border-dashed">
                <span>Calculated Freight / Shipping ({formCustomerType} Tier):</span>
                <span className="font-bold font-mono text-foreground">{formatPrice(calculatedShipping)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-foreground border-t pt-2">
                <span>Grand Total (Incl. GST & Shipping):</span>
                <span className="text-primary">{formatPrice(formGrandTotal + calculatedShipping)}</span>
              </div>
            </div>
          </div>

          {/* Form submit */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 border-t pt-4">
            <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto cursor-pointer">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto font-semibold cursor-pointer">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save & Issue Document"
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Invoice Barcode Scanner Modal */}
      <BarcodeScanner
        isOpen={isInvoiceScannerOpen}
        onClose={() => setIsInvoiceScannerOpen(false)}
        customerType={formCustomerType}
        onSelectVariant={(resolved) => {
          if (resolved && resolved.product && resolved.subVariant) {
            const prod = resolved.product;
            const cv = resolved.colorVariant || prod.colorVariants?.[0];
            const sv = resolved.subVariant;
            const color = cv?.color || "";
            const size = sv.size || "";
            const weight = sv.weight || "";
            const price = resolved.price || resolvePrice(sv, formCustomerType);

            const newItem = {
              productId: prod._id,
              productTitle: prod.title,
              color,
              size,
              weight,
              hsnCode: prod.hsnCode || "3924",
              gstRate: prod.gstRate || 18,
              mrp: sv.mrp,
              b2cPrice: sv.b2cPrice,
              b2bPrice: sv.b2bPrice,
              dropshippingPrice: sv.dropshippingPrice,
              sku: sv.sku,
              selectedVariants: { color, size, weight },
              quantity: 1,
              pricePerUnit: price
            };
            setFormItems(prev => [...prev, newItem]);
            addToast(`Added ${prod.title} (${color} ${size}) to document!`, "success");
          }
        }}
      />
    </div>
  );
}

