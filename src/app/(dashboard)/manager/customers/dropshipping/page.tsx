import * as React from "react";
import { AdminCustomersManager } from "@/components/admin/AdminCustomersManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerDropshippingCustomersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["customers_dropshipping"]}>
      <ManagerDropshippingCustomersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerDropshippingCustomersPage() {
  return <AdminCustomersManager initialType="Dropshipping" />;
}
