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
import { useCategoryStore } from "@/stores/categoryStore";

interface ProductDetailViewProps {
  slug: string;
  initialProduct?: Product | null;
  initialProducts: Product[];
}

import { trackViewItem } from "@/lib/gtm";

function ProductDetailInner() {
  const { product, toggleWishlist, isInWishlist } = useProductDetail();
  const { categories, initializeCategories } = useCategoryStore();

  React.useEffect(() => {
    initializeCategories();
  }, [initializeCategories]);

  React.useEffect(() => {
    if (product) {
      trackViewItem(product);
    }
  }, [product]);

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

  const breadcrumbItems = [];
  const category = categories.find(c => c._id === product.categoryId);
  const parentCategory = category?.parentId ? categories.find(c => c._id === category.parentId) : null;
  
  if (parentCategory) {
    breadcrumbItems.push({ label: parentCategory.name, href: `/products?category=${parentCategory.slug}` });
  }
  if (category) {
    breadcrumbItems.push({ label: category.name, href: `/products?category=${category.slug}` });
  }
  if (breadcrumbItems.length === 0) {
    breadcrumbItems.push({ label: "Products", href: "/products" });
  }
  
  const truncateTitle = (str: string, max: number = 50) => {
    if (!str) return str;
    return str.length > max ? str.substring(0, max) + "..." : str;
  };
  
  breadcrumbItems.push({ label: truncateTitle(product.title, 50) });

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 pt-4 md:pt-6 pb-12 text-foreground w-full">
      {/* Breadcrumb Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Breadcrumb items={breadcrumbItems} />
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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start mb-8 md:mb-12">
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
      <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-border/80">
        <RelatedProducts />
      </div>
    </div>
  );
}

export function ProductDetailView({ slug, initialProduct, initialProducts }: ProductDetailViewProps) {
  return (
    <ProductDetailProvider slug={slug} initialProduct={initialProduct} initialProducts={initialProducts}>
      <ProductDetailInner />
    </ProductDetailProvider>
  );
}
