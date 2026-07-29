import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { sanitizeHtml } from "@/lib/sanitize";
import { BlogPostItem } from "@/components/admin/cms/types";
import {
  Calendar,
  User,
  Clock,
  ArrowLeft,
  Share2,
  BookOpen,
  ArrowRight,
  MessageCircle,
  Globe,
  Copy,
} from "lucide-react";

import type { Metadata } from "next";
import { constructMetadata, generateBlogArticleSchema, generateBreadcrumbSchema } from "@/lib/seo";

export const revalidate = 300; // 5 min ISR caching for fast static rendering

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await dbConnect();
    const cmsBlogsDoc = await CmsContent.findOne({ key: "blogs" }).lean();
    const allBlogs: BlogPostItem[] = cmsBlogsDoc?.value || [];
    const blog = allBlogs.find((b) => b.slug === slug && b.isActive !== false);

    if (!blog) {
      return constructMetadata({ title: "Article Not Found", noIndex: true });
    }

    return constructMetadata({
      title: blog.title,
      description: blog.excerpt || blog.title,
      keywords: [blog.category || "E-commerce", "FlexSell Blog", "wholesale guide", "dropshipping tips"],
      image: blog.coverImage,
      type: "article",
      path: `/blogs/${blog.slug}`,
    });
  } catch (err) {
    return constructMetadata({ title: "FlexSell Industry Blog", path: `/blogs/${slug}` });
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  await dbConnect();
  const cmsBlogsDoc = await CmsContent.findOne({ key: "blogs" }).lean();
  const allBlogs: BlogPostItem[] = cmsBlogsDoc?.value || [];

  const blog = allBlogs.find((b) => b.slug === slug && b.isActive !== false);

  if (!blog) {
    notFound();
  }

  // Related articles in same category
  const relatedBlogs = allBlogs
    .filter((b) => b.slug !== slug && b.isActive !== false && b.category === blog.category)
  const articleJsonLd = generateBlogArticleSchema({
    title: blog.title,
    description: blog.excerpt,
    slug: blog.slug,
    coverImage: blog.coverImage,
    author: blog.author,
    publishedAt: blog.publishedAt,
  });
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Blogs", href: "/blogs" },
    { label: blog.title, href: `/blogs/${blog.slug}` }
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <article className="container mx-auto px-4 py-10 max-w-4xl space-y-8 text-foreground">
      {/* Top Breadcrumb Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link
          href="/blogs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Journal
        </Link>
        <span className="text-xs font-semibold text-muted-foreground">
          {blog.category || "General Insights"}
        </span>
      </div>

      {/* Article Header */}
      <header className="space-y-4 text-center sm:text-left">
        <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap text-xs">
          <span className="px-3 py-1 rounded-full font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
            {blog.category || "General"}
          </span>
          {blog.readTime && (
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {blog.readTime}
            </span>
          )}
          {blog.publishedAt && (
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(blog.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
          {blog.title}
        </h1>

        {blog.excerpt && (
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
            {blog.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-border/50 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-black flex items-center justify-center text-xs border border-primary/30">
              {(blog.author || "FlexSell")[0]}
            </div>
            <div>
              <p className="font-bold text-foreground">{blog.author || "FlexSell Editorial"}</p>
              <p className="text-[10px] text-muted-foreground">Wholesale Trade Contributor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-bold text-[11px] hidden sm:inline">Share:</span>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(blog.title + " - " + (typeof window !== "undefined" ? window.location.href : ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
              title="Share on WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
              title="Share on LinkedIn"
            >
              <Globe className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Cover Image */}
      {blog.coverImage && (
        <div className="rounded-3xl overflow-hidden border border-border bg-secondary shadow-md max-h-[420px]">
          <img
            src={blog.coverImage}
            alt={blog.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Main Body Article Render */}
      <div className="bg-card border rounded-3xl p-6 sm:p-10 shadow-sm">
        {blog.content ? (
          <div
            className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed text-base space-y-4"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(blog.content) }}
          />
        ) : (
          <p className="text-muted-foreground italic text-sm">
            {blog.excerpt || "Full content is being updated by author."}
          </p>
        )}
      </div>

      {/* Related Articles Section */}
      {relatedBlogs.length > 0 && (
        <div className="pt-8 border-t space-y-6">
          <h3 className="text-xl font-black text-foreground">Related Articles in {blog.category}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedBlogs.map((rel, idx) => (
              <div key={idx} className="bg-card border rounded-2xl p-4 space-y-2 flex flex-col justify-between hover:border-primary/40 transition-all">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-primary border px-2 py-0.5 rounded bg-primary/10">
                    {rel.category}
                  </span>
                  <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                    <Link href={`/blogs/${rel.slug}`}>{rel.title}</Link>
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{rel.excerpt}</p>
                </div>
                <Link
                  href={`/blogs/${rel.slug}`}
                  className="font-bold text-[11px] text-primary hover:underline flex items-center gap-1 pt-2"
                >
                  <span>Read Article</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
    </>
  );
}
