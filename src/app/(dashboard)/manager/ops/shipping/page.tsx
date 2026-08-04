import AdminShippingPage from "../../../admin/shipping/page";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerShippingPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["ops_shipping"]}>
      <ManagerShippingPage {...props} />
    </PermissionGuard>
  );
}

function ManagerShippingPage() {
  return <AdminShippingPage />;
}
