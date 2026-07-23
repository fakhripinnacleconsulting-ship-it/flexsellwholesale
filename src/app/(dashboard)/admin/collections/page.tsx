import * as React from "react";
import { collectionService } from "@/services/collectionService";
import { AdminCollectionsManager } from "@/components/admin/AdminCollectionsManager";

// Set dynamic rendering so collections list is always fresh on load
export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage() {
  const collections = await collectionService.getCollections();

  return (
    <div className="container mx-auto px-4 py-4 md:py-6">
      <AdminCollectionsManager initialCollections={collections} />
    </div>
  );
}
