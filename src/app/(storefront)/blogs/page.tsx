import * as React from "react";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";
import { BookOpen, Calendar, User, Clock, Search, ArrowRight, Sparkles } from "lucide-react";
import { BlogPostItem } from "@/components/admin/cms/types";

import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

export async function generateMetadata(): Promise<Metadata> {
  return constructMetadata({
    title: "Wholesale & Dropshipping E-Commerce Industry Blogs",
    description: "Insights, guides, and sourcing tips for Indian retailers, reseller businesses, e-commerce brands, and dropshippers.",
    keywords: ["b2b blog", "dropshipping guide India", "reseller tips", "wholesale insights"],
    path: "/blogs",
  });
}

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

  await dbConnect();
  const cmsBlogsDoc = await CmsContent.findOne({ key: "blogs" }).lean();
  const rawBlogs: BlogPostItem[] = (cmsBlogsDoc?.value || []).filter((b: any) => b.isActive !== false);

  // Filter by category and search query if provided
  const blogs = rawBlogs.filter((b) => {
    const matchesCat = !category || category === "all" || (b.category || "").toLowerCase() === category.toLowerCase();
    const matchesSearch =
      !q ||
      (b.title || "").toLowerCase().includes(q.toLowerCase()) ||
      (b.excerpt || "").toLowerCase().includes(q.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const featuredBlog = blogs[0];
  const remainingBlogs = blogs.slice(1);

  // Categories list
  const categorySet = new Set<string>();
  rawBlogs.forEach(b => { if (b.category) categorySet.add(b.category); });
  const categories = Array.from(categorySet);

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl space-y-10 text-foreground">
      {/* Page Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
          <Sparkles className="h-3.5 w-3.5" /> B2B Sourcing & Industry Insights
        </span>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
          FlexSell Wholesale Journal
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Expert guides, manufacturer insights, dropshipping strategies, and Indian B2B market trends to grow your reseller business.
        </p>
      </div>

      {/* Search & Category Tabs Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card border rounded-2xl p-4 shadow-sm">
        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto scrollbar-none">
          <Link
            href="/blogs"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              !category || category === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:text-foreground border"
            }`}
          >
            All Articles ({rawBlogs.length})
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/blogs?category=${encodeURIComponent(cat)}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                category?.toLowerCase() === cat.toLowerCase()
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-muted-foreground hover:text-foreground border"
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Search Form */}
        <form action="/blogs" method="GET" className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            name="q"
            defaultValue={q || ""}
            placeholder="Search articles..."
            className="w-full pl-8 pr-3 py-1.5 bg-background border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </form>
      </div>

      {/* Featured Hero Post */}
      {featuredBlog && !category && !q && (
        <div className="relative rounded-3xl overflow-hidden border border-border bg-card shadow-xl grid grid-cols-1 md:grid-cols-12 group">
          <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-primary text-primary-foreground">
                  Featured
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-secondary text-foreground border">
                  {featuredBlog.category || "General"}
                </span>
                {featuredBlog.readTime && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {featuredBlog.readTime}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-foreground group-hover:text-primary transition-colors leading-tight">
                <Link href={`/blogs/${featuredBlog.slug}`}>{featuredBlog.title}</Link>
              </h2>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
                {featuredBlog.excerpt}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border/50 text-xs">
              <div className="flex items-center gap-3">
                {featuredBlog.author && (
                  <span className="flex items-center gap-1.5 font-bold text-foreground">
                    <User className="h-3.5 w-3.5 text-primary" /> {featuredBlog.author}
                  </span>
                )}
                {featuredBlog.publishedAt && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(featuredBlog.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <Link
                href={`/blogs/${featuredBlog.slug}`}
                className="font-extrabold text-primary hover:underline flex items-center gap-1"
              >
                <span>Read Full Story</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="md:col-span-5 h-64 md:h-auto relative bg-secondary overflow-hidden">
            {featuredBlog.coverImage ? (
              <img
                src={featuredBlog.coverImage}
                alt={featuredBlog.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <BookOpen className="h-16 w-16 opacity-30" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid of Articles */}
      {blogs.length === 0 ? (
        <div className="text-center py-20 bg-card border rounded-3xl space-y-3">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <h3 className="text-lg font-bold text-foreground">No Articles Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No articles match your current search or category filter. Try clearing filters to view all stories.
          </p>
          <Link href="/blogs" className="inline-block text-xs font-bold text-primary hover:underline pt-2">
            Clear Filters & View All
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(category || q ? blogs : remainingBlogs).map((blog, idx) => (
            <article
              key={idx}
              className="bg-card border rounded-2xl overflow-hidden flex flex-col justify-between hover:border-primary/40 hover:shadow-lg transition-all group"
            >
              <div>
                <div className="h-48 relative bg-secondary overflow-hidden">
                  {blog.coverImage ? (
                    <img
                      src={blog.coverImage}
                      alt={blog.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <BookOpen className="h-10 w-10 opacity-30" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-background/90 backdrop-blur text-foreground border shadow-sm">
                      {blog.category || "General"}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-2">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    {blog.readTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {blog.readTime}
                      </span>
                    )}
                    {blog.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(blog.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                    <Link href={`/blogs/${blog.slug}`}>{blog.title}</Link>
                  </h3>

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                    {blog.excerpt}
                  </p>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-border/50 flex items-center justify-between text-xs mt-3">
                <span className="font-semibold text-muted-foreground truncate max-w-[150px]">
                  {blog.author || "Editorial Team"}
                </span>
                <Link
                  href={`/blogs/${blog.slug}`}
                  className="font-extrabold text-primary hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Read Article</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
