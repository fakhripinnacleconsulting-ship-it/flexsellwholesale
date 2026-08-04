import * as React from "react";
import { AdminOrderViewManager } from "@/components/admin/order/AdminOrderViewManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerOrderPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["orders_b2c","orders_b2b","orders_dropshipping"]}>
      <ManagerOrderPage {...props} />
    </PermissionGuard>
  );
}

function ManagerOrderPage(props: { params: Promise<{ id: string }> }) {
  return <AdminOrderViewManager params={props.params} />;
}
