import { AdminHsnManager } from "@/components/admin/AdminHsnManager";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerHsnPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["ops_hsn"]}>
      <ManagerHsnPage {...props} />
    </PermissionGuard>
  );
}

function ManagerHsnPage() {
  return <AdminHsnManager />;
}
