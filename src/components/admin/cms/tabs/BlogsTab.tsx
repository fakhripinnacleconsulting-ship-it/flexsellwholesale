"use client";

import * as React from "react";
import { Edit3, Trash2, BookOpen, ExternalLink, Calendar, User, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { BlogPostItem } from "../types";

interface BlogsTabProps {
  blogs: BlogPostItem[];
  onEdit: (idx: number, blog: BlogPostItem) => void;
  onDelete: (idx: number) => void;
}

export function BlogsTab({ blogs, onEdit, onDelete }: BlogsTabProps) {
  if (blogs.length === 0) {
    return (
      <div className="text-center py-12 border rounded-xl bg-card p-6 text-foreground space-y-3">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h4 className="font-bold text-base">No Blog Articles Found</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Start publishing blog articles and B2B industry news to drive organic search traffic and client engagement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-foreground">
      {blogs.map((blog, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl bg-card gap-4 hover:border-primary/30 transition-all">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            {blog.coverImage ? (
              <img
                src={blog.coverImage}
                alt={blog.title}
                className="w-16 h-16 rounded-lg object-cover border shrink-0 bg-secondary"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border shrink-0 bg-secondary/50 flex items-center justify-center text-muted-foreground">
                <BookOpen className="h-6 w-6" />
              </div>
            )}

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase text-primary border px-2 py-0.5 rounded bg-primary/10">
                  {blog.category || "General"}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  blog.isActive !== false
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }`}>
                  {blog.isActive !== false ? "Published" : "Draft"}
                </span>
                {blog.publishedAt && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(blog.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <h4 className="font-bold text-sm text-foreground truncate">{blog.title}</h4>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{blog.excerpt}</p>

              <div className="flex items-center gap-4 text-[11px] text-muted-foreground pt-0.5">
                {blog.author && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {blog.author}
                  </span>
                )}
                {blog.slug && (
                  <Link
                    href={`/blogs/${blog.slug}`}
                    target="_blank"
                    className="text-primary hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>View Article</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button size="sm" variant="outline" onClick={() => onEdit(idx, blog)} aria-label="Edit Blog Article" className="h-8 px-2.5 text-xs font-semibold cursor-pointer">
              <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:bg-destructive/10 cursor-pointer" onClick={() => onDelete(idx)} aria-label="Delete Blog Article">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
