import * as React from "react";
import { PublicCreateOrderView } from "@/components/storefront/create-order";
import { ManagerAccessDeniedView } from "@/components/managers/ManagerAccessDeniedView";
import { getActiveManagerServer, getActiveCustomerServer } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Dropshipping Order | FlexSell Wholesale",
  description: "Create and submit dropshipping orders with tier pricing and Amazon shipment details.",
};

async function CreateOrderPageContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const admin = await getActiveCustomerServer();
  const manager = await getActiveManagerServer();

  // 1. If not logged in as Admin or Manager, redirect to Manager Login page
  if (!admin && !manager) {
    redirect("/manager/login?redirect=/create-order");
  }

  // 2. If logged in as Admin, allow full access
  if (admin && admin.role === "admin") {
    const salesperson = typeof searchParams?.salesperson === "string" ? searchParams.salesperson : undefined;
    return <PublicCreateOrderView initialSalesperson={salesperson} />;
  }

  // 3. If logged in as Manager, verify required orders_dropshipping permission
  if (manager) {
    const perms: string[] = manager.permissions || [];
    const hasDropPerm = perms.includes("orders_dropshipping") || perms.includes("orders_dropship") || perms.some(p => p.startsWith("orders_dropshipping:"));
    if (!hasDropPerm) {
      return <ManagerAccessDeniedView requiredPermission="orders_dropshipping" />;
    }
  }

  const salesperson = typeof searchParams?.salesperson === "string" ? searchParams.salesperson : undefined;
  return <PublicCreateOrderView initialSalesperson={salesperson} />;
}

export default async function PublicCreateOrderPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading Dropship Portal...</div>}>
      <CreateOrderPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
