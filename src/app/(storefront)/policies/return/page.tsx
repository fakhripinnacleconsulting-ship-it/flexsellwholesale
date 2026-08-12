import * as React from "react";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/PolicyLayout";
import { getPolicyData } from "@/lib/getPolicyData";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600; // ISR revalidation every 60s

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getPolicyData("return");
  return constructMetadata({
    title: policy.title,
    description: `Official ${policy.title} for FlexSell Wholesale buyers.`,
    keywords: [policy.title, "Return Policy", "Refund Policy", "FlexSell returns"],
    path: "/policies/return",
  });
}

export default async function ShortReturnPage() {
  const policy = await getPolicyData("return");

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/return" },
    { label: policy.title, href: "/policies/return" }
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
        activeKey="return"
        content={policy.content}
        sections={policy.sections}
      />
    </>
  );
}
