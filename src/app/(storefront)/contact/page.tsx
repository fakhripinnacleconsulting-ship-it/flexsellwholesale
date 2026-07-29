import type { Metadata } from "next";
import { constructMetadata, generateLocalBusinessSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { ContactView } from "@/components/storefront/ContactView";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Contact Us & B2B Wholesale Support",
    description: "Get in touch with FlexSell Wholesale for bulk order inquiries, dropshipping support, custom container shipping, or visiting our Bhopal logistics warehouse.",
    keywords: ["Contact FlexSell", "Flexsell support", "wholesale Bhopal contact", "bulk inquiry India", "flexsell email"],
    path: "/contact",
  });
}

export default function ContactPage() {
  const localBusinessJsonLd = generateLocalBusinessSchema();
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Contact Us", href: "/contact" }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ContactView />
    </>
  );
}
