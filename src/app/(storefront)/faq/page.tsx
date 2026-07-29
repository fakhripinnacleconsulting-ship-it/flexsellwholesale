import type { Metadata } from "next";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { constructMetadata, generateFAQSchema, generateBreadcrumbSchema } from "@/lib/seo";
import { FaqView, FaqItem } from "@/components/storefront/FaqView";

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Frequently Asked Questions (FAQ) & B2B Sourcing Help",
    description: "Get answers to common questions about FlexSell B2B MOQs, shipping rates, GST invoices, return policies, and blind dropshipping fulfillment.",
    keywords: ["FlexSell FAQ", "b2b wholesale questions", "dropshipping faq India", "wholesale minimum order quantity"],
    path: "/faq",
  });
}

export default async function FAQPage() {
  let faqs: FaqItem[] = [];
  try {
    await dbConnect();
    const cmsDoc = await CmsContent.findOne({ key: "faqs" }).lean();
    if (cmsDoc?.value && Array.isArray(cmsDoc.value)) {
      faqs = cmsDoc.value;
    }
  } catch (err) {
    console.error("Server fetch FAQs notice:", err);
  }

  const faqJsonLd = generateFAQSchema(
    faqs.length > 0 ? faqs : [
      { question: "What is the Minimum Order Quantity (MOQ)?", answer: "FlexSell allows low MOQs starting at 5 to 10 units per SKU to support small Indian retailers." },
      { question: "Do you provide GST Invoices for B2B tax input?", answer: "Yes! All orders include an official GST invoice containing your GSTIN for full Input Tax Credit (ITC)." }
    ]
  );
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "FAQ", href: "/faq" }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <FaqView initialFaqs={faqs} />
    </>
  );
}
