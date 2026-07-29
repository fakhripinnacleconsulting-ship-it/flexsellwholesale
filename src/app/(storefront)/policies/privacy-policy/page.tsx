import * as React from "react";
import type { Metadata } from "next";
import { PolicyLayout } from "@/components/storefront/PolicyLayout";
import { getPolicyData } from "@/lib/getPolicyData";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 3600; // ISR revalidation every 1 hour

export async function generateMetadata(): Promise<Metadata> {
  const policy = await getPolicyData("privacy");
  return constructMetadata({
    title: policy.title,
    description: `Official ${policy.title} for FlexSell Wholesale B2B marketplace.`,
    keywords: [policy.title, "FlexSell privacy policy", "B2B data protection", "wholesale terms"],
    path: "/policies/privacy-policy",
  });
}

export default async function PrivacyPolicyPage() {
  const policy = await getPolicyData("privacy");

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/privacy-policy" },
    { label: policy.title, href: "/policies/privacy-policy" }
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
        activeKey="privacy"
        content={policy.content}
        sections={policy.sections}
      />
    </>
  );
}
