"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CmsViewModalProps {
  isOpen: boolean;
  viewData: any;
  onClose: () => void;
}

export function CmsViewModal({ isOpen, viewData, onClose }: CmsViewModalProps) {
  if (!isOpen || !viewData) return null;

  const isVideo = viewData.mediaType === "video" || !!viewData.videoUrl || viewData.contentType === "video";
  const videoSrc = viewData.videoUrl || viewData.mediaUrl;
  const imageSrc = viewData.posterUrl || viewData.imageUrl || viewData.mediaUrl;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in text-foreground">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="font-bold text-base">CMS Entry Preview</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-secondary rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 text-xs">
          {isVideo && videoSrc ? (
            <div className="aspect-video relative rounded-lg overflow-hidden bg-black border border-border shadow">
              <video
                src={videoSrc}
                poster={imageSrc}
                controls
                className="w-full h-full object-cover"
              />
            </div>
          ) : imageSrc ? (
            <div className="aspect-video relative rounded-lg overflow-hidden bg-secondary border border-border shadow">
              <img src={imageSrc} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <pre className="p-3 bg-secondary/30 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-sans">
            {JSON.stringify(viewData, null, 2)}
          </pre>
        </div>
        <div className="flex justify-end border-t pt-3">
          <Button type="button" variant="outline" onClick={onClose}>Close Preview</Button>
        </div>
      </div>
    </div>
  );
}
