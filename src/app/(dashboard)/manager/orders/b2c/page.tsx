import { OrderList } from "@/components/managers/OrderList";

export default function ManagerB2COrdersPage() {
  return (
    <OrderList
      title="B2C Orders"
      description="Manage retail orders from direct consumers."
      customerTypeFilter="B2C"
    />
  );
}
