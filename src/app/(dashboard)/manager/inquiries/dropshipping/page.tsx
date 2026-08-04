import * as React from "react";
import { AdminInquiriesManager } from "@/components/admin/AdminInquiriesManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerDropshippingInquiriesPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["inquiries_dropshipping"]}>
      <ManagerDropshippingInquiriesPage {...props} />
    </PermissionGuard>
  );
}

function ManagerDropshippingInquiriesPage() {
  return <AdminInquiriesManager initialCategory="dropshipping" />;
}
