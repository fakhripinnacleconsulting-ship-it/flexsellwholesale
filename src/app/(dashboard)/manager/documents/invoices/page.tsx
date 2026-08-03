import { InvoiceList } from "@/components/managers/InvoiceList";

export default function ManagerInvoicesPage() {
  return (
    <InvoiceList
      title="Invoices"
      description="Manage all standard invoices."
      docType="invoice"
    />
  );
}
