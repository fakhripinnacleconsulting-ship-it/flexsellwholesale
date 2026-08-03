import { OrderList } from "@/components/managers/OrderList";

export default function ManagerDropshipOrdersPage() {
  return (
    <OrderList
      title="Dropshipping Orders"
      description="Manage orders for dropshipping accounts."
      customerTypeFilter="Dropshipping"
    />
  );
}
