import AdminCmsPage from "../../../admin/cms/page";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerCmsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["content_cms"]}>
      <ManagerCmsPage {...props} />
    </PermissionGuard>
  );
}

function ManagerCmsPage() {
  return <AdminCmsPage />;
}
