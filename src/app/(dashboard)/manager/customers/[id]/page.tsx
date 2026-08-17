"use client";

import * as React from "react";
import { PermissionGuard } from "@/components/managers/PermissionGuard";
import { CustomerDetail } from "@/components/shared/CustomerDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProtectedManagerCustomerDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  return (
    <PermissionGuard requiredPermissions={["customers_b2c", "customers_b2b", "customers_dropshipping"]}>
      <CustomerDetail customerId={resolvedParams.id} />
    </PermissionGuard>
  );
}
