import { InvoiceList } from "@/components/managers/InvoiceList";

export default function ManagerReceiptsPage() {
  return (
    <InvoiceList
      title="Receipts"
      description="Manage payment receipts."
      docType="receipt"
    />
  );
}
