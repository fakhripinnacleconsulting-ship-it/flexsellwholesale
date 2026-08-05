import * as React from "react";
import { PublicCreateOrderView } from "@/components/storefront/create-order";
import { getActiveManagerServer, getActiveCustomerServer } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Dropshipping Order | FlexSell Wholesale",
  description: "Create and submit dropshipping orders with tier pricing and Amazon shipment details.",
};

async function CreateOrderPageContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const customer = await getActiveCustomerServer();
  const manager = await getActiveManagerServer();

  // If not logged in (neither customer nor manager), redirect to login
  if (!customer && !manager) {
    redirect("/login?redirect=/create-order");
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
