import * as React from "react";
import { AdminInquiriesManager } from "@/components/admin/AdminInquiriesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerFranchiseInquiriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["inquiries_franchise"]}>
      <ManagerFranchiseInquiriesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerFranchiseInquiriesPage() {
  return <AdminInquiriesManager initialCategory="franchise" />;
}
