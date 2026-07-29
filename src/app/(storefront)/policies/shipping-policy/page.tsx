import * as React from "react";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/PolicyLayout";
import { getPolicyData } from "@/lib/getPolicyData";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600; // ISR revalidation every 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getPolicyData("shipping");
  return constructMetadata({
    title: policy.title,
    description: `Official ${policy.title} for FlexSell Wholesale pan-India dispatch and logistics.`,
    keywords: [policy.title, "Shipping Policy", "FlexSell shipping", "bulk freight dispatch"],
    path: "/policies/shipping-policy",
  });
}

export default async function ShippingPolicyPage() {
  const policy = await getPolicyData("shipping");

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/shipping-policy" },
    { label: policy.title, href: "/policies/shipping-policy" }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PolicyLayout
        title={policy.title}
        lastUpdated={policy.lastUpdated}
        activeKey="shipping"
        content={policy.content}
        sections={policy.sections}
      />
    </>
  );
}
