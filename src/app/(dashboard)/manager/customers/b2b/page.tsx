import * as React from "react";
import { AdminCustomersManager } from "@/components/admin/AdminCustomersManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerB2BCustomersPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["customers_b2b"]}>
      <ManagerB2BCustomersPage {...props} />
    </PermissionGuard>
  );
}

function ManagerB2BCustomersPage() {
  return <AdminCustomersManager initialType="B2B" />;
}
