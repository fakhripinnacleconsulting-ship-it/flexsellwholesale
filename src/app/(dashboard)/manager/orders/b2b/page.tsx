import { OrderList } from "@/components/managers/OrderList";

export default function ManagerB2BOrdersPage() {
  return (
    <OrderList
      title="B2B Orders"
      description="Manage wholesale orders from B2B buyers."
      customerTypeFilter="B2B"
    />
  );
}
