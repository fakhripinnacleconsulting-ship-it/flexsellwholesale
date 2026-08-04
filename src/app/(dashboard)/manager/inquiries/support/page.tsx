import * as React from "react";
import { AdminInquiriesManager } from "@/components/admin/AdminInquiriesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerSupportInquiriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["inquiries_support"]}>
      <ManagerSupportInquiriesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerSupportInquiriesPage() {
  return <AdminInquiriesManager initialCategory="support" />;
}
