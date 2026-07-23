"use client";

import * as React from "react";
import { Eye, Edit3, Trash2, Video, Image as ImageIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BannerSlide } from "../types";

interface BannersTabProps {
  banners: BannerSlide[];
  onView: (banner: BannerSlide) => void;
  onEdit: (idx: number, banner: BannerSlide) => void;
  onDelete: (idx: number) => void;
}

export function BannersTab({ banners, onView, onEdit, onDelete }: BannersTabProps) {
  return (
    <div className="space-y-3">
      {banners.map((banner, idx) => {
        const isVideo = banner.mediaType === "video" || !!banner.videoUrl;
        const thumbnail = isVideo ? (banner.posterUrl || banner.imageUrl) : banner.imageUrl;

        return (
          <div
            key={idx}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl bg-card hover:border-primary/30 transition-all gap-4 text-foreground"
          >
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-14 rounded overflow-hidden border bg-secondary shrink-0">
                {thumbnail ? (
                  <img src={thumbnail} alt="Banner Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    {isVideo ? <Video className="h-5 w-5 text-muted-foreground" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                )}
                {isVideo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Play className="h-5 w-5 text-white fill-white opacity-90" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {isVideo ? (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                      <Video className="h-3 w-3" /> Video
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                      <ImageIcon className="h-3 w-3" /> Image
                    </span>
                  )}
                  {banner.overlayTitle && (
                    <span className="font-bold text-xs text-foreground line-clamp-1">{banner.overlayTitle}</span>
                  )}
                </div>
                <p className="font-semibold text-xs text-foreground/80 line-clamp-1">Redirect: {banner.redirectUrl || "/products"}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-1">
                  Alt: {banner.altText || "No alt text"} {isVideo && banner.videoUrl ? `• Video: ${banner.videoUrl}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => onView(banner)} aria-label="View Banner">
                <Eye className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(idx, banner)} aria-label="Edit Banner">
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(idx)} aria-label="Delete Banner">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
