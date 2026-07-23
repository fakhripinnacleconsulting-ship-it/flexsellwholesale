"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { ProductDetailProvider, useProductDetail } from "./product-detail/ProductDetailContext";
import { ImageGallery } from "./product-detail/ImageGallery";
import { AddToCartPanel } from "./product-detail/AddToCartPanel";
import { VariantSelector } from "./product-detail/VariantSelector";
import { ProductInfoTabs } from "./product-detail/ProductInfoTabs";
import { ReviewSection } from "./product-detail/ReviewSection";
import { RelatedProducts } from "./product-detail/RelatedProducts";

interface ProductDetailViewProps {
  slug: string;
  initialProducts: Product[];
}

function ProductDetailInner() {
  const { product, toggleWishlist, isInWishlist } = useProductDetail();

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-foreground">
        <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-6">The product you are looking for does not exist in our wholesale catalog.</p>
        <Link href="/products">
          <Button>Back to Products</Button>
        </Link>
      </div>
    );
  }

  const favorited = isInWishlist(product._id);

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-8 text-foreground w-full">
      {/* Breadcrumb Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Breadcrumb items={[
          { label: "Products", href: "/products" },
          { label: product.title }
        ]} />
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => toggleWishlist(product)}
          className={favorited ? "text-destructive border-destructive bg-destructive/5 hover:bg-destructive/10 cursor-pointer" : "cursor-pointer"}
        >
          <Heart className={`h-4 w-4 mr-2 ${favorited ? "fill-destructive" : ""}`} />
          {favorited ? "Saved in Wishlist" : "Save to Wishlist"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
        {/* Left: Interactive Image Gallery */}
        <ImageGallery />

        {/* Right: Specifications, Selection & Action Panel */}
        <div className="md:col-span-7 flex flex-col space-y-6">
          <AddToCartPanel />
          <VariantSelector />
          <ProductInfoTabs />
          <ReviewSection />
        </div>
      </div>

      {/* Bottom Carousel Feeds & Marketing Material */}
      <RelatedProducts />
    </div>
  );
}

export function ProductDetailView({ slug, initialProducts }: ProductDetailViewProps) {
  return (
    <ProductDetailProvider slug={slug} initialProducts={initialProducts}>
      <ProductDetailInner />
    </ProductDetailProvider>
  );
}
