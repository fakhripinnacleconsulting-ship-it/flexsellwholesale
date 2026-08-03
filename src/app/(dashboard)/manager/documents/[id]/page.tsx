"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { InvoiceDocument } from "@/components/documents/InvoiceDocument";
import { triggerPrintWithTitle } from "@/lib/pdfPrintHelper";
import { buildSellerInfo } from "@/lib/buildSellerInfo";
import { apiClient } from "@/lib/apiClient";
import { useToastStore } from "@/stores/toastStore";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DocumentPreviewPage({ params }: PageProps) {
  const router = useRouter();
  const { addToast } = useToastStore();
  const resolvedParams = React.use(params);
  const documentId = resolvedParams.id;

  const [invoice, setInvoice] = React.useState<any>(null);
  const [order, setOrder] = React.useState<any>(null);
  const [cmsData, setCmsData] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // Load CMS Data for seller info
        const cmsRes = await fetch("/api/cms");
        const cms = await cmsRes.json();
        setCmsData(cms);

        // Fetch invoice
        const invData = await apiClient.get<any>(`/invoices?search=${documentId}`);
        const inv = invData?.invoices?.find((i: any) => i._id === documentId);
        
        if (!inv) {
          setError("Document not found");
          return;
        }
        
        setInvoice(inv);

        // Reconstruct order data for InvoiceDocument
        setOrder({
          _id: inv.orderId || "MANUAL_INVOICE",
          orderId: inv.orderId || "MANUAL_INVOICE",
          createdAt: inv.generatedAt,
          amount: inv.amount,
          items: inv.items.map((it: any) => ({
            id: it._id || Math.random().toString(),
            product: { 
              title: it.name, 
              gstRate: it.taxRate || 18, 
              hsnCode: it.hsnCode || "3924", 
              priceIncludesGst: false 
            },
            quantity: it.quantity,
            pricePerUnit: it.unitPrice,
            selectedVariants: it.variants || {}
          })),
          shippingAddress: inv.shippingAddress,
          shippingCost: inv.shippingCost || 0
        });
      } catch (err: any) {
        setError(err.message || "Failed to load document");
        addToast("Failed to load document details", "error");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [documentId, addToast]);

  const handlePrint = () => {
    triggerPrintWithTitle(`Document_${documentId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <h2 className="text-xl font-bold mb-2">Loading Document...</h2>
      </div>
    );
  }

  if (error || !invoice || !order) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-3" />
        <h2 className="text-2xl font-bold mb-2">Document Not Found</h2>
        <p className="text-muted-foreground mb-6">{error || "The requested document could not be found."}</p>
        <Button onClick={() => router.back()}><ArrowLeft className="mr-2 h-4 w-4" /> Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden border-b pb-4">
        <Button onClick={() => router.back()} variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={handlePrint} className="font-bold flex items-center gap-1.5 shadow-sm h-9 text-xs">
          <Printer className="h-3.5 w-3.5" /> Print Document
        </Button>
      </div>

      <Card className="print-shadow-none border border-border print:border-none">
        <CardContent className="p-6">
          <InvoiceDocument
            type={invoice.type || "invoice"}
            documentNumber={invoice._id}
            order={order}
            customerId={invoice.customerId}
            sellerInfo={buildSellerInfo(cmsData)}
            showActions={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
