import * as React from "react";
import { AdminInquiriesManager } from "@/components/admin/AdminInquiriesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerWholesaleInquiriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["inquiries_wholesale"]}>
      <ManagerWholesaleInquiriesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerWholesaleInquiriesPage() {
  return <AdminInquiriesManager initialCategory="wholesale" />;
}
