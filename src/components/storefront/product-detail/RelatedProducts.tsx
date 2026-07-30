"use client";

import * as React from "react";
import { ProductCarousel } from "../ProductCarousel";
import { useProductDetail } from "./ProductDetailContext";
import { sanitizeImgUrl } from "@/lib/utils";

export function RelatedProducts() {
  const {
    product,
    recentProducts,
    relatedProducts,
    otherProducts
  } = useProductDetail();

  if (!product) return null;

  return (
    <div className="space-y-10 md:space-y-14">
      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <div>
          <ProductCarousel
            title="Related Products"
            subtitle="Top wholesale items from the same category"
            products={relatedProducts}
          />
        </div>
      )}

      {/* Recently Viewed Products Carousel */}
      {recentProducts.length > 0 && (
        <div className={relatedProducts.length > 0 ? "border-t border-border/80 pt-8 md:pt-10" : ""}>
          <ProductCarousel
            title="Recently Viewed Products"
            subtitle="Product lines you checked in this session"
            products={recentProducts}
          />
        </div>
      )}

      {/* A+ Content Section */}
      {product.aPlusContent && product.aPlusContent.length > 0 && (
        <div className="border-t border-border/80 pt-8 md:pt-10">
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground mb-6 text-center">
            Manufacturer A+ Marketing Material
          </h3>
          <div className="flex flex-col w-full max-w-[970px] mx-auto gap-4">
            {product.aPlusContent.map((block) => {
              const cleanUrl = sanitizeImgUrl(block.imageUrl || "");
              if (cleanUrl) {
                return (
                  <img
                    key={block.id}
                    src={cleanUrl}
                    alt={block.alt || "Manufacturer marketing graphic sheet"}
                    className="w-full h-auto block rounded-lg shadow-sm border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=970&q=80";
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Other Products Carousel */}
      {otherProducts.length > 0 && (
        <div className="border-t border-border/80 pt-8 md:pt-10">
          <ProductCarousel
            title="Other Wholesale Deals"
            subtitle="Explore hot items from our wholesale catalog"
            products={otherProducts}
          />
        </div>
      )}
    </div>
  );
}
