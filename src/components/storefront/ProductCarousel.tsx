"use client";

import * as React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Product } from "@/types";
import { ProductCard } from "./ProductCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductCarouselProps {
  title: string;
  subtitle?: string;
  products: Product[];
}

export function ProductCarousel({ title, subtitle, products }: ProductCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
  });

  const scrollPrev = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = React.useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Autoplay effect
  React.useEffect(() => {
    if (!emblaApi) return;

    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 5000); // Auto-slide every 5 seconds

    return () => clearInterval(interval);
  }, [emblaApi]);

  if (!products || products.length === 0) return null;

  return (
    <div className="space-y-6 relative group">
      <div>
        <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>

      <div className="relative">
        {/* Navigation Buttons */}
        <button
          onClick={scrollPrev}
          className="absolute -left-4 top-1/2 -translate-y-1/2 bg-background border border-border text-foreground p-2 rounded-full shadow hover:bg-secondary transition-all z-20 cursor-pointer opacity-0 group-hover:opacity-100"
          title="Scroll Left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={scrollNext}
          className="absolute -right-4 top-1/2 -translate-y-1/2 bg-background border border-border text-foreground p-2 rounded-full shadow hover:bg-secondary transition-all z-20 cursor-pointer opacity-0 group-hover:opacity-100"
          title="Scroll Right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Embla Viewport */}
        <div className="overflow-hidden py-2 px-1" ref={emblaRef}>
          {/* Embla Container */}
          <div className="flex gap-6">
            {products.map((prod) => (
              <div key={prod._id} className="w-[240px] flex-shrink-0">
                <ProductCard product={prod} layout="grid" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
