"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useProductDetail } from "./ProductDetailContext";
import { sanitizeImgUrl } from "@/lib/utils";

export function ImageGallery() {
  const {
    product,
    activeVariant,
    activeSubVariant,
    activeImageIdx,
    setActiveImageIdx
  } = useProductDetail();

  const [isHovered, setIsHovered] = React.useState(false);
  const thumbnailContainerRef = React.useRef<HTMLDivElement>(null);

  if (!product) return null;

  const visibility = product.fieldVisibility || {
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  };

  const currentImages = activeVariant?.images || [];

  // 5-Second Auto-Slide Carousel Timer (Pauses on Hover)
  React.useEffect(() => {
    if (!visibility.showImages || currentImages.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      const nextIdx = (activeImageIdx + 1) % currentImages.length;
      setActiveImageIdx(nextIdx);
    }, 5000);

    return () => clearInterval(timer);
  }, [currentImages.length, activeImageIdx, isHovered, visibility.showImages, setActiveImageIdx]);

  // Previous & Next slide handlers
  const handlePrevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImages.length <= 1) return;
    const prevIdx = activeImageIdx === 0 ? currentImages.length - 1 : activeImageIdx - 1;
    setActiveImageIdx(prevIdx);
  };

  const handleNextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentImages.length <= 1) return;
    const nextIdx = (activeImageIdx + 1) % currentImages.length;
    setActiveImageIdx(nextIdx);
  };

  return (
    <div className="md:col-span-5 flex flex-col-reverse md:flex-row gap-4 items-start w-full md:sticky md:top-32 lg:top-36 self-start z-10">
      {/* Slider thumbnails list (Left on desktop, bottom on mobile) */}
      {visibility.showImages && currentImages.length > 1 && (
        <div
          ref={thumbnailContainerRef}
          className="flex md:flex-col gap-2.5 overflow-x-auto md:overflow-y-auto pb-2 pr-1 md:pb-0 md:pr-0 w-full md:w-22 md:max-h-[480px] flex-shrink-0 scrollbar-none select-none"
        >
          {currentImages.map((img, i) => {
            const rawUrl = typeof img === "string" ? img : img.url || "";
            const url = sanitizeImgUrl(rawUrl);
            const alt = typeof img === "string" ? `Thumbnail ${i + 1}` : img.alt || `Thumbnail ${i + 1}`;
            const isActive = activeImageIdx === i;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImageIdx(i)}
                onMouseEnter={() => setActiveImageIdx(i)}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden flex-shrink-0 bg-secondary/30 transition-all relative cursor-pointer ${
                  isActive
                    ? "border-primary scale-95 shadow-md ring-2 ring-primary/20"
                    : "border-border/80 hover:border-primary/50 opacity-80 hover:opacity-100"
                }`}
              >
                {url ? (
                  <Image src={url} alt={alt} fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-secondary flex items-center justify-center text-[9px] text-muted-foreground font-semibold">
                    No Image
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Smooth Sliding Image Carousel Viewport */}
      <div
        className="flex-1 w-full aspect-square bg-card rounded-2xl overflow-hidden border border-border shadow-sm relative group select-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {currentImages.length > 0 ? (
          <div
            className="flex w-full h-full transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeImageIdx * 100}%)` }}
          >
            {currentImages.map((img, i) => {
              const rawUrl = typeof img === "string" ? img : img.url || "";
              const url = sanitizeImgUrl(rawUrl);
              const alt = typeof img === "string" ? `${product.title} ${i + 1}` : img.alt || product.title;

              return (
                <div key={i} className="w-full h-full flex-shrink-0 relative bg-card">
                  {url ? (
                    <Image
                      src={url}
                      alt={alt}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={i === 0}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center text-sm font-semibold text-muted-foreground">
                      No Image Available
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center text-sm font-semibold text-muted-foreground">
            No Image Available
          </div>
        )}

        {/* Discount Badge */}
        {activeSubVariant && activeSubVariant.discount > 0 && (
          <span className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-xs font-black px-3 py-1.5 rounded-full shadow-md animate-pulse z-10">
            {activeSubVariant.discount}% DISCOUNT
          </span>
        )}

        {/* Carousel Arrow Controls (Visible when more than 1 image exists) */}
        {currentImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevSlide}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer opacity-90 sm:opacity-0 group-hover:opacity-100 z-10"
              aria-label="Previous Image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNextSlide}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer opacity-90 sm:opacity-0 group-hover:opacity-100 z-10"
              aria-label="Next Image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Bottom Dots Indicator Bar */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full z-10">
              {currentImages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activeImageIdx === idx ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
