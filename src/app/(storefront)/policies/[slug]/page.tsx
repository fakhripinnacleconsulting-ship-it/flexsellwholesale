import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { pagesContent } from "@/config/pagesContent";
import { sanitizeHtml } from "@/lib/sanitize";
import { constructMetadata, generateBreadcrumbSchema } from "@/lib/seo";
import { ShieldCheck, FileText, Truck, RotateCcw, Printer, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SLUG_ALIAS_MAP: Record<string, string> = {
  privacy: "privacy",
  "privacy-policy": "privacy",
  terms: "terms",
  "terms-of-service": "terms",
  shipping: "shipping",
  "shipping-policy": "shipping",
  return: "return",
  "return-policy": "return",
  refund: "return",
  "refund-policy": "return",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  try {
    const { slug } = await params;
    const key = SLUG_ALIAS_MAP[slug] || slug;
    const policy = pagesContent.policies[key as keyof typeof pagesContent.policies];

    if (!policy) {
      return constructMetadata({ title: "Legal Policy", path: `/policies/${slug}` });
    }

    return constructMetadata({
      title: policy.title,
      description: `Official ${policy.title} for FlexSell Wholesale B2B marketplace buyers and suppliers.`,
      keywords: [policy.title, "FlexSell policy", "B2B legal disclosure", "wholesale terms"],
      path: `/policies/${slug}`,
    });
  } catch (err) {
    return constructMetadata({ title: "Legal Policy", path: "/policies/privacy" });
  }
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizedKey = SLUG_ALIAS_MAP[slug] || slug;

  let cmsPolicies: any = null;
  try {
    await dbConnect();
    const cmsPoliciesDoc = await CmsContent.findOne({ key: "policies" }).lean();
    cmsPolicies = cmsPoliciesDoc?.value;
  } catch (err) {
    console.error("Policy DB fetch notice:", err);
  }

  const policyData =
    cmsPolicies?.[slug] ||
    cmsPolicies?.[normalizedKey] ||
    pagesContent.policies[normalizedKey as keyof typeof pagesContent.policies];

  if (!policyData) {
    notFound();
  }

  const navItems = [
    { key: "privacy", label: "Privacy Policy", icon: ShieldCheck, href: "/policies/privacy" },
    { key: "terms", label: "Terms of Service", icon: FileText, href: "/policies/terms" },
    { key: "shipping", label: "Shipping & Logistics", icon: Truck, href: "/policies/shipping" },
    { key: "return", label: "Returns & Refunds", icon: RotateCcw, href: "/policies/return" },
  ];

  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Policies", href: "/policies/privacy" },
    { label: policyData.title, href: `/policies/${slug}` }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="container mx-auto px-4 py-10 max-w-6xl text-foreground">
        {/* Top Breadcrumb Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-8 print:hidden">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Storefront
          </Link>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Navigation Sidebar */}
          <div className="md:col-span-3 space-y-2 print:hidden">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block mb-2 px-2">
              Legal & Compliance
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = normalizedKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-card border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Main Content Body */}
          <div className="md:col-span-9 space-y-6 bg-card border rounded-2xl p-6 md:p-10 shadow-sm print:p-0 print:border-none print:shadow-none">
            <div className="border-b pb-4">
              <span className="text-xs font-extrabold uppercase text-primary tracking-wider border px-2.5 py-1 rounded-full bg-primary/10">
                Legal Disclosure
              </span>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-3 text-foreground">
                {policyData.title}
              </h1>
              <p className="text-muted-foreground text-xs font-semibold mt-1">
                Last updated: {policyData.lastUpdated || "July 2026"}
              </p>
            </div>

            {/* Render Rich HTML Content if set by Admin */}
            {policyData.content ? (
              <div
                className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed text-sm md:text-base space-y-4"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(policyData.content) }}
              />
            ) : (
              /* Fallback to default sections */
              <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
                {policyData.sections?.map((section: any, idx: number) => (
                  <div key={idx} className="space-y-2">
                    <h2 className="text-lg font-bold mt-6 text-foreground">{section.heading}</h2>
                    <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{section.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
