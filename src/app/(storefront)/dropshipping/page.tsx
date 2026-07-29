import type { Metadata } from "next";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";
import { DropshippingView } from "@/components/dropshipping/DropshippingView";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Blind Dropshipping Supplier India | Zero Investment E-Commerce",
    description: "Start automated blind dropshipping with FlexSell. Direct factory fulfillment across India, RTO management, automated Shopify sync, and high profit margins.",
    keywords: ["dropshipping supplier India", "blind dropshipping", "dropshiping partner", "dropshipin", "drop sping", "ecomerce sourcing"],
    path: "/dropshipping",
  });
}

export default function DropshippingPage() {
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Dropshipping Program", href: "/dropshipping" }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <DropshippingView />
    </>
  );
}
