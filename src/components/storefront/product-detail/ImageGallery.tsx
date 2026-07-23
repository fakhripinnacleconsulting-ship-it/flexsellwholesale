"use client";

import * as React from "react";
import Image from "next/image";
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

  if (!product) return null;

  const visibility = product.fieldVisibility || {
    showDescription: true,
    showSizes: true,
    showWeights: true,
    showDimensions: true,
    showImages: true,
  };

  const currentImages = activeVariant?.images || [];
  const mainImageObj = currentImages[activeImageIdx];
  const rawMainImage = mainImageObj
    ? typeof mainImageObj === "string"
      ? mainImageObj
      : mainImageObj.url || ""
    : "";
  const mainImage = sanitizeImgUrl(rawMainImage, "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=600&q=80");
  const mainImageAlt = mainImageObj && typeof mainImageObj !== "string"
    ? mainImageObj.alt
    : product.title;

  return (
    <div className="md:col-span-5 flex flex-col-reverse md:flex-row gap-4 items-start w-full md:sticky md:top-24 self-start z-10">
      {/* Slider thumbnails list (Left on desktop, bottom on mobile) */}
      {visibility.showImages && currentImages.length > 1 && (
        <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto pb-2 pr-1 md:pb-0 md:pr-0 w-full md:w-24 md:max-h-[500px] flex-shrink-0 scrollbar-none">
          {currentImages.map((img, i) => {
            const rawUrl = typeof img === "string" ? img : img.url || "";
            const url = sanitizeImgUrl(rawUrl);
            const alt = typeof img === "string" ? `Thumbnail ${i}` : img.alt || `Thumbnail ${i}`;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveImageIdx(i)}
                className={`w-20 h-20 rounded-lg border-2 overflow-hidden flex-shrink-0 bg-secondary transition-all relative cursor-pointer ${
                  activeImageIdx === i ? "border-primary scale-95 shadow-sm" : "border-border hover:border-primary/50"
                }`}
              >
                <Image src={url} alt={alt} fill sizes="80px" className="object-cover" />
              </button>
            );
          })}
        </div>
      )}

      {/* Large Main Image */}
      <div className="flex-1 w-full aspect-square bg-card rounded-xl overflow-hidden border border-border shadow-sm flex items-center justify-center relative">
        <Image
          src={mainImage}
          alt={mainImageAlt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          className="object-cover hover:scale-102 transition-transform duration-300"
        />
        {activeSubVariant && activeSubVariant.discount > 0 && (
          <span className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-xs font-black px-2.5 py-1 rounded shadow animate-pulse">
            {activeSubVariant.discount}% DISCOUNT
          </span>
        )}
      </div>
    </div>
  );
}
