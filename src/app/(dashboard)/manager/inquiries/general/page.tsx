import * as React from "react";
import { AdminInquiriesManager } from "@/components/admin/AdminInquiriesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerGeneralInquiriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["inquiries_general"]}>
      <ManagerGeneralInquiriesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerGeneralInquiriesPage() {
  return <AdminInquiriesManager initialCategory="general" />;
}
