import AdminCouponsPage from "../../../admin/coupons/page";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerCouponsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["ops_coupons"]}>
      <ManagerCouponsPage {...props} />
    </PermissionGuard>
  );
}

function ManagerCouponsPage() {
  return <AdminCouponsPage />;
}
