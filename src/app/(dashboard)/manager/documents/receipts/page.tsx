import * as React from "react";
import { AdminInvoicesManager } from "@/components/admin/invoice/AdminInvoicesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerReceiptsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["invoices_receipt"]}>
      <ManagerReceiptsPage {...props} />
    </PermissionGuard>
  );
}

function ManagerReceiptsPage() {
  return <AdminInvoicesManager initialTab="receipt" />;
}
