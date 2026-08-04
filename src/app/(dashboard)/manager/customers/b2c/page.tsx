import * as React from "react";
import { AdminCustomersManager } from "@/components/admin/AdminCustomersManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerB2CCustomersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["customers_b2c"]}>
      <ManagerB2CCustomersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerB2CCustomersPage() {
  return <AdminCustomersManager initialType="B2C" />;
}
