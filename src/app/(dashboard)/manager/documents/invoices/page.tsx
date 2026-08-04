import * as React from "react";
import { AdminInvoicesManager } from "@/components/admin/invoice/AdminInvoicesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerInvoicesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["invoices_invoice"]}>
      <ManagerInvoicesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerInvoicesPage() {
  return <AdminInvoicesManager initialTab="invoice" />;
}
