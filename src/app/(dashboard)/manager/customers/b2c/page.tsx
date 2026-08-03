import { CustomerList } from "@/components/managers/CustomerList";

export default function ManagerB2CCustomersPage() {
  return (
    <CustomerList
      title="B2C Customers"
      description="Manage retail customers and individual buyers."
      customerTypeFilter="B2C"
    />
  );
}
