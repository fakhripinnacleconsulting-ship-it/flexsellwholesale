import { CustomerList } from "@/components/managers/CustomerList";

export default function ManagerB2BCustomersPage() {
  return (
    <CustomerList
      title="B2B Customers"
      description="Manage wholesale customers and businesses."
      customerTypeFilter="B2B"
    />
  );
}
