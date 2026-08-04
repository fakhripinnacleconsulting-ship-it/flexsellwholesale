import * as React from "react";
import { AdminInvoicesManager } from "@/components/admin/invoice/AdminInvoicesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerQuotesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["invoices_quote"]}>
      <ManagerQuotesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerQuotesPage() {
  return <AdminInvoicesManager initialTab="quote" />;
}
