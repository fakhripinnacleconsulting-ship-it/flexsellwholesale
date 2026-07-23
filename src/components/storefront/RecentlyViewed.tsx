"use client";

import * as React from "react";
import { Product } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { getRecentlyViewed } from "@/lib/recentlyViewedTracker";
import { ProductCard } from "./ProductCard";
import { motion } from "framer-motion";
import { History, ChevronLeft, ChevronRight } from "lucide-react";

interface RecentlyViewedProps {
  initialProducts?: Product[];
}

export function RecentlyViewed({ initialProducts = [] }: RecentlyViewedProps) {
  const { products } = useProductStore();
  const [recentProducts, setRecentProducts] = React.useState<Product[]>([]);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);

  React.useEffect(() => {
    const activeProducts = products.length > 0 ? products : initialProducts;
    if (activeProducts.length === 0) return;

    const ids = getRecentlyViewed();
    if (ids.length === 0) return;

    const matched = ids
      .map((id) => activeProducts.find((p) => p._id === id))
      .filter((p): p is Product => Boolean(p))
      .slice(0, 10);

    setRecentProducts(matched);
  }, [products, initialProducts]);

  if (recentProducts.length === 0) return null;

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -320, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 320, behavior: "smooth" });
    }
  };

  // Robust Global Window Mouse Drag Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    const ele = scrollContainerRef.current;
    const startX = e.pageX - ele.offsetLeft;
    const initialScrollLeft = ele.scrollLeft;
    setIsMouseDown(true);

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const x = moveEvent.pageX - ele.offsetLeft;
      const walk = (x - startX) * 1.5;
      ele.scrollLeft = initialScrollLeft - walk;
    };

    const handleWindowMouseUp = () => {
      setIsMouseDown(false);
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
  };

  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4 select-none"
    >
      <div className="flex justify-between items-end mb-6 border-b pb-4 border-border/60">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" /> Recently Viewed
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Products you previously explored in this session.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scrollLeft}
            className="p-2 border rounded-full hover:bg-secondary transition-colors text-foreground cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            className="p-2 border rounded-full hover:bg-secondary transition-colors text-foreground cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onDragStart={(e) => e.preventDefault()}
        className={`flex gap-4 overflow-x-auto scrollbar-none pb-4 pt-1 touch-pan-x ${
          isMouseDown ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        {recentProducts.map((product) => (
          <div key={product._id} className="w-[240px] sm:w-[280px] flex-shrink-0">
            <ProductCard product={product} layout="grid" />
          </div>
        ))}
      </div>
    </motion.section>
  );
}
