"use client";

import React, { useState, useEffect } from "react";
import { useInvoiceForm } from "@/hooks/useInvoiceForm";
import { InvoiceCreateModal } from "@/components/admin/invoice/InvoiceCreateModal";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, RefreshCw, Truck } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface PublicCreateOrderViewProps {
  initialSalesperson?: string;
}

export function PublicCreateOrderView({ initialSalesperson }: PublicCreateOrderViewProps) {
  const [orderResult, setOrderResult] = useState<any>(null);

  const invoiceForm = useInvoiceForm({
    isPublicMode: true,
    apiEndpoint: "/orders/public",
    onSuccess: (res: any) => {
      setOrderResult(res);
    },
  });

  // Lock to Dropshipping + Order Creation Mode on mount
  useEffect(() => {
    invoiceForm.setFormCustomerType("Dropshipping");
    invoiceForm.setIsOrderCreationMode(true);
    invoiceForm.setFormDocType("receipt");
    invoiceForm.setIsCreateModalOpen(true); // Triggers product/customer loading
    if (initialSalesperson) {
      invoiceForm.setSalesperson(initialSalesperson);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setOrderResult(null);
    invoiceForm.setFormCustomerType("Dropshipping");
    invoiceForm.setIsOrderCreationMode(true);
    invoiceForm.setFormDocType("receipt");
    invoiceForm.setIsCreateModalOpen(true);
  };

  // Success state
  if (orderResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6 text-foreground">
        <Card className="border-2 border-emerald-500/30 bg-card shadow-2xl overflow-hidden">
          <div className="bg-emerald-500 text-white p-8 text-center space-y-2">
            <CheckCircle2 className="h-16 w-16 mx-auto animate-bounce" />
            <h2 className="text-3xl font-black tracking-tight">Dropshipping Order Confirmed!</h2>
            <p className="text-sm text-emerald-100 font-medium">
              Your order has been generated and dispatched to the warehouse fulfillment queue.
            </p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-secondary/20 border border-border/80 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Order ID</span>
                <span className="font-mono font-bold text-foreground text-sm">{orderResult.orderId}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Document ID</span>
                <span className="font-mono font-bold text-foreground text-sm">{orderResult.invoiceId}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Total Amount</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                  {formatPrice(orderResult.amount || 0)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold block">Status</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  {orderResult.status || "Processing"}
                </span>
              </div>
            </div>

            <div className="space-y-3 border-t pt-4 text-xs">
              <h4 className="font-bold text-foreground flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-primary" /> Fulfillment Notice
              </h4>
              <p className="text-muted-foreground leading-relaxed">
                The order details have been synchronized with the central warehouse portal.
                Our logistics team will process, pack, and generate the courier tracking label shortly.
              </p>
            </div>

            <div className="flex items-center justify-center border-t pt-6">
              <Button
                onClick={handleReset}
                className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 cursor-pointer shadow-md px-8 py-2.5"
              >
                <RefreshCw className="h-4 w-4" /> Create Another Order
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Order creation form — reuses the exact same InvoiceCreateModal
  return (
    <InvoiceCreateModal
      isOpen={true}
      isPublicMode={true}
      onClose={() => {}} // No-op: can't close a page
      editInvoiceId={null}
      isOrderCreationMode={true}
      formDocType={invoiceForm.formDocType}
      setFormDocType={invoiceForm.setFormDocType}
      formCustomerType={invoiceForm.formCustomerType}
      setFormCustomerType={invoiceForm.setFormCustomerType}
      customers={invoiceForm.customers}
      customerMode={invoiceForm.customerMode}
      setCustomerMode={invoiceForm.setCustomerMode}
      selectedCustomerId={invoiceForm.selectedCustomerId}
      setSelectedCustomerId={invoiceForm.setSelectedCustomerId}
      newCustName={invoiceForm.newCustName}
      setNewCustName={invoiceForm.setNewCustName}
      newCustEmail={invoiceForm.newCustEmail}
      setNewCustEmail={invoiceForm.setNewCustEmail}
      newCustPhone={invoiceForm.newCustPhone}
      setNewCustPhone={invoiceForm.setNewCustPhone}
      newCustCompany={invoiceForm.newCustCompany}
      setNewCustCompany={invoiceForm.setNewCustCompany}
      newCustGstin={invoiceForm.newCustGstin}
      setNewCustGstin={invoiceForm.setNewCustGstin}
      newCustAddress={invoiceForm.newCustAddress}
      setNewCustAddress={invoiceForm.setNewCustAddress}
      newCustCity={invoiceForm.newCustCity}
      setNewCustCity={invoiceForm.setNewCustCity}
      newCustState={invoiceForm.newCustState}
      setNewCustState={invoiceForm.setNewCustState}
      newCustPinCode={invoiceForm.newCustPinCode}
      setNewCustPinCode={invoiceForm.setNewCustPinCode}
      products={invoiceForm.products}
      formItems={invoiceForm.formItems}
      setFormItems={invoiceForm.setFormItems}
      selectedProductId={invoiceForm.selectedProductId}
      setSelectedProductId={invoiceForm.setSelectedProductId}
      productSearch={invoiceForm.productSearch}
      setProductSearch={invoiceForm.setProductSearch}
      selectedColor={invoiceForm.selectedColor}
      setSelectedColor={invoiceForm.setSelectedColor}
      selectedSize={invoiceForm.selectedSize}
      setSelectedSize={invoiceForm.setSelectedSize}
      selectedWeight={invoiceForm.selectedWeight}
      setSelectedWeight={invoiceForm.setSelectedWeight}
      itemQty={invoiceForm.itemQty}
      setItemQty={invoiceForm.setItemQty}
      itemPrice={invoiceForm.itemPrice}
      setItemPrice={invoiceForm.setItemPrice}
      paymentMethod={invoiceForm.paymentMethod}
      setPaymentMethod={invoiceForm.setPaymentMethod}
      paymentStatus={invoiceForm.paymentStatus}
      setPaymentStatus={invoiceForm.setPaymentStatus}
      transactionId={invoiceForm.transactionId}
      setTransactionId={invoiceForm.setTransactionId}
      salesperson={invoiceForm.salesperson}
      setSalesperson={invoiceForm.setSalesperson}
      invoiceNotes={invoiceForm.invoiceNotes}
      setInvoiceNotes={invoiceForm.setInvoiceNotes}
      isSubmitting={invoiceForm.isSubmitting}
      onSaveInvoice={invoiceForm.handleSaveInvoice}
      addToast={invoiceForm.addToast}
      shippingConfig={invoiceForm.shippingConfig}
      includeDropshipDetails={invoiceForm.includeDropshipDetails}
      setIncludeDropshipDetails={invoiceForm.setIncludeDropshipDetails}
      dropshipDetails={invoiceForm.dropshipDetails}
      setDropshipDetails={invoiceForm.setDropshipDetails}
    />
  );
}
