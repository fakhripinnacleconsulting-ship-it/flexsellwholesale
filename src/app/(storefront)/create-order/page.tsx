import * as React from "react";
import { PublicCreateOrderView } from "@/components/storefront/PublicCreateOrderView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Dropshipping Order | FlexSell Wholesale",
  description: "Public portal to create and submit dropshipping orders with tier pricing and Amazon shipment details.",
};

function CreateOrderPageContent({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const salesperson = typeof searchParams?.salesperson === "string" ? searchParams.salesperson : undefined;
  return <PublicCreateOrderView initialSalesperson={salesperson} />;
}

export default function PublicCreateOrderPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = React.use(props.searchParams);
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-muted-foreground">Loading Dropship Portal...</div>}>
      <CreateOrderPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
