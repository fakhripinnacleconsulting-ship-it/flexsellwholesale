import { InvoiceList } from "@/components/managers/InvoiceList";

export default function ManagerQuotesPage() {
  return (
    <InvoiceList
      title="Quotes"
      description="Manage customer quotes and estimates."
      docType="quote"
    />
  );
}
