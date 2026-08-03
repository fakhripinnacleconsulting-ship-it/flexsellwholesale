import { CustomerList } from "@/components/managers/CustomerList";

export default function ManagerDropshippingCustomersPage() {
  return (
    <CustomerList
      title="Dropshipping Customers"
      description="Manage dropshipping partners."
      customerTypeFilter="Dropshipping"
    />
  );
}
