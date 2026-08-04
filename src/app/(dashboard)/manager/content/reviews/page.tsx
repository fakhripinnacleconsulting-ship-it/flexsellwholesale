import AdminReviewsPage from "../../../admin/reviews/page";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerReviewsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["content_reviews"]}>
      <ManagerReviewsPage {...props} />
    </PermissionGuard>
  );
}

function ManagerReviewsPage() {
  return <AdminReviewsPage />;
}
