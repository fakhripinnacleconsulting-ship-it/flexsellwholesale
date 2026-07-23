import * as React from "react";
import { ClientOrdersView } from "@/components/storefront/ClientOrdersView";

export default function ClientOrdersPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-foreground text-center">Loading B2B order records...</div>}>
      <ClientOrdersView />
    </React.Suspense>
  );
}
