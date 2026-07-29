import type { Metadata } from "next";
import { constructMetadata, generateOrganizationSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { AboutView } from "@/components/storefront/AboutView";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "About Us | India's Direct Factory B2B Sourcing Platform",
    description: "Learn about FlexSell Wholesale, our 40,000 sq ft central logistics hub in Bhopal, and our mission to eliminate middle-man markups for Indian retailers and dropshippers.",
    keywords: ["About FlexSell", "Flexsell company", "wholesale Bhopal", "B2B importer India", "direct factory pricing"],
    path: "/about",
  });
}

export default function AboutPage() {
  const orgJsonLd = generateOrganizationSchema();
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "About Us", href: "/about" }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <AboutView />
    </>
  );
}
