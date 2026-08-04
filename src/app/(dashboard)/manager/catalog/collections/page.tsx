import * as React from "react";
import { collectionService } from "@/services/collectionService";
import { AdminCollectionsManager } from "@/components/admin/AdminCollectionsManager";

export const dynamic = "force-dynamic";

import { PermissionGuard } from "@/components/managers/PermissionGuard";

export default function ProtectedManagerCollectionsPage(props: any) {
  return (
    <PermissionGuard requiredPermissions={["catalog_collections"]}>
      <ManagerCollectionsPage {...props} />
    </PermissionGuard>
  );
}

async function ManagerCollectionsPage() {
  const collections = await collectionService.getCollections();

  return (
    <div className="container mx-auto px-4 py-4 md:py-6">
      <AdminCollectionsManager initialCollections={collections} />
    </div>
  );
}
