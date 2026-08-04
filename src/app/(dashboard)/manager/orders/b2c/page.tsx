import * as React from "react";
import { AdminOrdersManager } from "@/components/admin/order";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerB2COrdersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["orders_b2c"]}>
      <ManagerB2COrdersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerB2COrdersPage() {
  return <AdminOrdersManager initialTab="B2C" />;
}
