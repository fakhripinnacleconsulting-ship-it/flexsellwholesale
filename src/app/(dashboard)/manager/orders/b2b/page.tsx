import * as React from "react";
import { AdminOrdersManager } from "@/components/admin/order";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerB2BOrdersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["orders_b2b"]}>
      <ManagerB2BOrdersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerB2BOrdersPage() {
  return <AdminOrdersManager initialTab="B2B" />;
}
