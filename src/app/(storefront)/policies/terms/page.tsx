import * as React from "react";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/PolicyLayout";
import { getPolicyData } from "@/lib/getPolicyData";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600; // ISR revalidation every 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getPolicyData("terms");
  return constructMetadata({
    title: policy.title,
    description: `Official ${policy.title} for FlexSell Wholesale marketplace buyers and sellers.`,
    keywords: [policy.title, "Terms of Service", "FlexSell terms", "B2B wholesale agreement"],
    path: "/policies/terms",
  });
}

export default async function ShortTermsPage() {
  const policy = await getPolicyData("terms");

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/terms" },
    { label: policy.title, href: "/policies/terms" }
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
        activeKey="terms"
        content={policy.content}
        sections={policy.sections}
      />
    </>
  );
}
