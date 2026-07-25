"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Heart, ShoppingCart, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { formatPrice, sanitizeImgUrl } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import { resolvePrice, canPurchase, resolveMoq, isPureB2B } from "@/lib/priceTierHelper";

interface ProductCardProps {
  product: Product;
  layout?: "grid" | "list";
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { addItem } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addToast } = useToastStore();
  const customer = useAuthStore((state: any) => state.customer);

  const [isMounted, setIsMounted] = React.useState(false);
  const [currentImgIndex, setCurrentImgIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);

  // Touch & Drag Swipe references
  const touchStartX = React.useRef<number | null>(null);
  const touchEndX = React.useRef<number | null>(null);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const favorited = isMounted ? isInWishlist(product._id) : false;
  const defaultVariant = product.colorVariants?.[0];
  const defaultSub = defaultVariant?.subVariants?.[0];

  // Collect ALL product & variant images for the carousel
  const allImages = React.useMemo(() => {
    const imgs: string[] = [];
    product.colorVariants?.forEach((cv) => {
      cv.images?.forEach((img) => {
        const url = typeof img === "string" ? img : img?.url;
        if (url && url.trim()) {
          const sanitized = sanitizeImgUrl(url);
          if (sanitized && !imgs.includes(sanitized)) {
            imgs.push(sanitized);
          }
        }
      });
    });
    if (imgs.length === 0) {
      imgs.push("https://placehold.co/400x400/10b981/ffffff?text=Product");
    }
    return imgs;
  }, [product.colorVariants]);

  // Auto-slide effect (every 2.8 seconds on hover)
  React.useEffect(() => {
    if (allImages.length <= 1 || !isHovered) return;
    const interval = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % allImages.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [allImages.length, isHovered]);

  const customerTypes = customer?.customerTypes || ["B2C"];
  const purchaseAllowed = !customer || canPurchase(customerTypes);
  
  const moq = defaultSub ? resolveMoq(defaultSub, customerTypes) : 1;
  const pureB2B = isPureB2B(customerTypes);
  const orderQty = pureB2B ? moq : 1;

  const price = defaultSub ? resolvePrice(defaultSub, customerTypes, orderQty) : 0;
  const mrp = defaultSub?.mrp ?? 0;
  const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const isBestseller = product.cardTags?.some(tag => tag.toLowerCase() === "bestseller" || tag.toLowerCase() === "best seller");
  const isNew = product.cardTags?.some(tag => tag.toLowerCase() === "new");
  const isTrending = product.cardTags?.some(tag => tag.toLowerCase() === "trending" || tag.toLowerCase() === "hot");

  // Title truncation to max 50 characters
  const truncatedTitle = product.title.length > 50 ? product.title.slice(0, 50).trim() + "..." : product.title;

  const handleCardClick = () => {
    router.push(`/products/${product.slug}`);
  };

  const nextImage = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCurrentImgIndex((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCurrentImgIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  // Touch Swipe Handlers (Mobile & Tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diffX = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 30;

    if (diffX > minSwipeDistance) {
      nextImage();
    } else if (diffX < -minSwipeDistance) {
      prevImage();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!purchaseAllowed) {
      addToast("Dropshipping accounts cannot place orders directly from storefront.", "warning");
      return;
    }

    addItem(
      product,
      {
        Color: defaultVariant?.color || "Standard",
        Size: defaultSub?.size || "Standard",
        Weight: defaultSub?.weight || "250g"
      },
      orderQty
    );
    addToast(`${product.title} added to cart successfully.`, "success");
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  return (
    <Card 
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col h-full bg-card hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative group border border-border/80 cursor-pointer select-none rounded-xl overflow-hidden max-w-sm w-full mx-auto"
    >
      {/* Fixed Floating Overlay Badges */}
      <div className="absolute top-2 left-2 z-20 flex flex-col gap-1 pointer-events-none">
        {discount > 0 && (
          <span className="bg-destructive text-destructive-foreground text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
            {discount}% OFF
          </span>
        )}
        {isBestseller && (
          <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
            BESTSELLER
          </span>
        )}
        {isNew && (
          <span className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
            NEW
          </span>
        )}
        {isTrending && (
          <span className="bg-purple-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow uppercase tracking-wider">
            TRENDING
          </span>
        )}
      </div>

      {/* Fixed Wishlist Button */}
      <button 
        type="button"
        onClick={handleWishlistToggle}
        className="absolute top-2 right-2 z-20 bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive p-1.5 rounded-full shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer"
        title="Toggle Wishlist"
      >
        <Heart className={`h-4 w-4 transition-colors ${favorited ? "fill-destructive text-destructive" : ""}`} />
      </button>

      {/* Interactive Image Carousel Viewport */}
      <div 
        className="aspect-square relative bg-secondary/20 overflow-hidden border-b select-none touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div 
          className="flex w-full h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentImgIndex * 100}%)` }}
        >
          {allImages.map((imgSrc, i) => (
            <div key={i} className="w-full h-full flex-shrink-0 relative">
              <Image
                src={imgSrc}
                alt={`${product.title} - Image ${i + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority={i === 0}
              />
            </div>
          ))}
        </div>

        {/* Carousel Arrow Controls */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
              title="Previous Image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shadow"
              title="Next Image"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Carousel Dot Indicators */}
            <div className="absolute bottom-2 left-0 right-0 z-20 flex justify-center items-center gap-1.5 pointer-events-auto">
              {allImages.map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setCurrentImgIndex(dotIdx);
                  }}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    currentImgIndex === dotIdx ? "w-4 bg-primary shadow-xs" : "w-1.5 bg-white/70 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* Fixed B2B MOQ Badge */}
        {(customer?.customerTypes?.includes("B2B") && defaultSub?.b2bMoq) && (
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded z-20 shadow-xs">
            MOQ: {defaultSub.b2bMoq} pcs
          </div>
        )}
      </div>

      {/* Card Content Details */}
      <CardContent className="p-3.5 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1">
          {/* Truncated Name (50 chars max with ...) */}
          <h3 
            className="font-bold text-sm text-foreground group-hover:text-primary transition-colors leading-snug" 
            title={product.title}
          >
            {truncatedTitle}
          </h3>

          {/* Industry Level 5-Star Filled Rating System */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <div className="flex items-center text-amber-400">
              {[1, 2, 3, 4, 5].map((starIdx) => {
                const ratingVal = product.rating && product.rating > 0 ? product.rating : 4.5;
                const isFull = ratingVal >= starIdx;
                const isHalf = !isFull && ratingVal >= starIdx - 0.5;

                return (
                  <Star
                    key={starIdx}
                    className={`h-3.5 w-3.5 ${
                      isFull
                        ? "fill-amber-400 text-amber-400"
                        : isHalf
                        ? "fill-amber-400/50 text-amber-400"
                        : "fill-muted/20 text-muted-foreground/30"
                    }`}
                  />
                );
              })}
            </div>
            <span className="font-bold text-foreground text-xs font-mono">
              {(product.rating && product.rating > 0 ? product.rating : 4.5).toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground font-normal">
              ({product.reviewCount || 12})
            </span>
          </div>
        </div>

        {/* Bottom Section: Amount on Top / Button Below on Mobile, Side-by-Side on Desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 mt-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-col min-w-0">
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-base font-black text-primary">{formatPrice(price)}</span>
              {mrp > price && (
                <span className="text-[11px] text-muted-foreground line-through font-medium">{formatPrice(mrp)}</span>
              )}
            </div>
          </div>

          <Button 
            className="w-full sm:w-auto font-bold flex items-center justify-center gap-1.5 cursor-pointer text-xs h-8.5 px-3 flex-shrink-0" 
            size="sm"
            onClick={handleAddToCart}
            disabled={product.totalStock <= 0 || !purchaseAllowed}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            {product.totalStock <= 0 ? "Out of Stock" : !purchaseAllowed ? "Dropship Only" : "Add to Cart"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
