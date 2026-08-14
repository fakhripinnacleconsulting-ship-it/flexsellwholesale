"use client";
import { formatDateIST } from "@/lib/datetime";

import * as React from "react";
import { Edit3, Trash2, BookOpen, ExternalLink, Calendar, User, Search, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Link from "next/link";
import { BlogPostItem } from "../types";

interface BlogsTabProps {
  blogs: BlogPostItem[];
  onEdit: (idx: number, blog: BlogPostItem) => void;
  onDelete: (idx: number) => void;
}

export function BlogsTab({ blogs, onEdit, onDelete }: BlogsTabProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    blogs.forEach(b => { if (b.category) set.add(b.category); });
    return Array.from(set);
  }, [blogs]);

  const filteredBlogs = React.useMemo(() => {
    return blogs.filter(blog => {
      const matchesSearch =
        (blog.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (blog.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (blog.author || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === "all" || blog.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [blogs, searchQuery, categoryFilter]);

  if (blogs.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed rounded-2xl bg-card p-6 text-foreground space-y-3">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="font-extrabold text-base">No Blog Articles Published Yet</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Publish blog articles and B2B market updates to boost organic traffic and customer retention.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-foreground">
      {/* Search & Category Filter Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 border rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search blog title, excerpt, author..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
              categoryFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({blogs.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-colors whitespace-nowrap cursor-pointer ${
                categoryFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Blogs List */}
      {filteredBlogs.length === 0 ? (
        <div className="text-center py-10 border rounded-xl bg-card text-muted-foreground text-xs font-semibold">
          No blog posts match your filter criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBlogs.map((blog, idx) => {
            const originalIndex = blogs.findIndex(b => b === blog);

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl bg-card gap-4 hover:border-primary/30 transition-all shadow-sm"
              >
                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                  {blog.coverImage ? (
                    <img
                      src={blog.coverImage}
                      alt={blog.title}
                      className="w-20 h-20 rounded-xl object-cover border shrink-0 bg-secondary"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl border shrink-0 bg-secondary/50 flex items-center justify-center text-muted-foreground">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase text-primary border px-2 py-0.5 rounded bg-primary/10">
                        {blog.category || "General"}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          blog.isActive !== false
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        }`}
                      >
                        {blog.isActive !== false ? "Published" : "Draft"}
                      </span>
                      {blog.readTime && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 border px-1.5 py-0.5 rounded bg-secondary/30">
                          <Clock className="h-3 w-3" /> {blog.readTime}
                        </span>
                      )}
                      {blog.publishedAt && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateIST(new Date(blog.publishedAt))}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-foreground truncate">{blog.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{blog.excerpt}</p>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-1">
                      {blog.author && (
                        <span className="flex items-center gap-1 font-medium">
                          <User className="h-3 w-3 text-primary" /> {blog.author}
                        </span>
                      )}
                      {blog.slug && (
                        <Link
                          href={`/blogs/${blog.slug}`}
                          target="_blank"
                          className="text-primary hover:underline flex items-center gap-1 font-bold ml-auto"
                        >
                          <span>View Public Page</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(originalIndex >= 0 ? originalIndex : idx, blog)}
                    aria-label="Edit Blog Article"
                    className="h-8 px-3 text-xs font-bold cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-destructive hover:bg-destructive/10 cursor-pointer"
                    onClick={() => onDelete(originalIndex >= 0 ? originalIndex : idx)}
                    aria-label="Delete Blog Article"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
