import * as React from "react";
import { AdminOrdersManager } from "@/components/admin/order";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerDropshippingOrdersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["orders_dropshipping","orders_dropship"]}>
      <ManagerDropshippingOrdersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerDropshippingOrdersPage() {
  return <AdminOrdersManager initialTab="Dropshipping" />;
}
