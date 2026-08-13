import * as React from "react";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/PolicyLayout";
import { getPolicyData } from "@/lib/getPolicyData";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getPolicyData("shipping");
  return constructMetadata({
    title: policy.title,
    description: `Official ${policy.title} for FlexSell Wholesale pan-India dispatch and logistics.`,
    keywords: [policy.title, "Shipping Policy", "FlexSell shipping", "bulk freight dispatch"],
    path: "/policies/shipping",
  });
}

export default async function ShortShippingPage() {
  const policy = await getPolicyData("shipping");

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/shipping" },
    { label: policy.title, href: "/policies/shipping" }
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
