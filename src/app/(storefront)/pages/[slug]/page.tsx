import * as React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { sanitizeHtml } from "@/lib/sanitize";
import { constructMetadata } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

interface StaticPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
  updatedAt: string;
}

async function getStaticPage(slug: string): Promise<StaticPage | null> {
  try {
    await dbConnect();
    const doc = await CmsContent.findOne({ key: "staticPages" }).lean();
    const pages = (doc?.value as StaticPage[]) || [];
    const page = pages.find((p) => p.slug === slug && p.isActive);
    return page || null;
  } catch (err) {
    console.error("Failed to fetch static page:", err);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getStaticPage(slug);
  if (!page) return constructMetadata({ title: "Page Not Found", noIndex: true, path: `/pages/${slug}` });
  return constructMetadata({
    title: page.seoTitle || page.title,
    description: page.seoDescription || `${page.title} — FlexSell Wholesale`,
    path: `/pages/${slug}`,
  });
}

export default async function StaticContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getStaticPage(slug);

  if (!page) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl text-foreground">
      <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">{page.title}</h1>
      <div
        className="prose prose-slate dark:prose-invert max-w-none leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
      />
    </div>
  );
}
