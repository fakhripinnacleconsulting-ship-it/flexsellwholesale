"use client";

import * as React from "react";
import { CustomerDetail } from "@/components/shared/CustomerDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminCustomerDetailPage({ params }: PageProps) {
  const resolvedParams = React.use(params);
  return <CustomerDetail customerId={resolvedParams.id} />;
}
