"use client";

import * as React from "react";
import { ProductCarousel } from "../ProductCarousel";
import { useProductDetail } from "./ProductDetailContext";

export function RelatedProducts() {
  const {
    product,
    recentProducts,
    relatedProducts,
    otherProducts
  } = useProductDetail();

  if (!product) return null;

  return (
    <div className="space-y-16">
      {/* Related Products Carousel */}
      {relatedProducts.length > 0 && (
        <div className="border-t pt-10">
          <ProductCarousel
            title="Related Products"
            subtitle="Top wholesale items from the same category"
            products={relatedProducts}
          />
        </div>
      )}

      {/* Recently Viewed Products Carousel */}
      {recentProducts.length > 0 && (
        <div className="border-t pt-10">
          <ProductCarousel
            title="Recently Viewed Products"
            subtitle="Cargo lines you checked in this session"
            products={recentProducts}
          />
        </div>
      )}

      {/* A+ Content Section */}
      {product.aPlusContent && product.aPlusContent.length > 0 && (
        <div className="border-t pt-10">
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground mb-6 text-center">
            Manufacturer A+ Marketing Material
          </h3>
          <div className="flex flex-col w-full max-w-[970px] mx-auto gap-4">
            {product.aPlusContent.map((block) => {
              if (block.imageUrl) {
                return (
                  <img
                    key={block.id}
                    src={block.imageUrl}
                    alt={block.alt || "Manufacturer marketing graphic sheet"}
                    className="w-full h-auto block rounded-lg shadow-sm border"
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
        <div className="border-t pt-10">
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
