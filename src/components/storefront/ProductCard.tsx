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
import { resolvePrice, canPurchase, resolveMoq, isPureB2B, type PriceTier } from "@/lib/priceTierHelper";
import { trackAddToCart } from "@/lib/gtm";

interface ProductCardProps {
  product: Product;
  layout?: "grid" | "list";
}

export function ProductCard({ product, layout = "grid" }: ProductCardProps) {
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
    return imgs;
  }, [product.colorVariants]);

  // Auto-slide effect (every 1.2 seconds on hover)
  React.useEffect(() => {
    if (allImages.length <= 1 || !isHovered) return;
    const interval = setInterval(() => {
      setCurrentImgIndex((prev) => (prev + 1) % allImages.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [allImages.length, isHovered]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (allImages.length > 1) {
      setCurrentImgIndex((prev) => (prev + 1) % allImages.length);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentImgIndex(0);
  };

  const customerTypes = customer?.customerTypes;
  const hasCustomerTypes = Boolean(customerTypes && customerTypes.length > 0);

  const effectiveTierOrTypes: PriceTier | string[] = hasCustomerTypes
    ? customerTypes!
    : (product.defaultPriceTier || "B2C");

  const purchaseAllowed = !customer || canPurchase(hasCustomerTypes ? customerTypes! : ["B2C"]);
  
  const moq = defaultSub ? resolveMoq(defaultSub, effectiveTierOrTypes) : 1;
  const pureB2B = Array.isArray(effectiveTierOrTypes)
    ? isPureB2B(effectiveTierOrTypes)
    : effectiveTierOrTypes === "B2B";
  const orderQty = pureB2B ? moq : 1;

  const price = defaultSub ? resolvePrice(defaultSub, effectiveTierOrTypes, orderQty) : 0;
  const mrp = defaultSub?.mrp ?? 0;
  const discount = defaultSub?.discount || (mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0);

  const isBestseller = product.cardTags?.some((t) => t.toLowerCase() === "bestseller");
  const isNew = product.cardTags?.some((t) => t.toLowerCase() === "new");
  const isTrending = product.cardTags?.some((t) => t.toLowerCase() === "trending");

  // Title truncation for grid (max 50 chars), full or longer title for list view
  const truncatedTitle = layout === "list"
    ? product.title
    : (product.title.length > 50 ? product.title.slice(0, 50).trim() + "..." : product.title);

  const handleCardClick = () => {
    router.push(`/products/${product.slug}`);
  };

  const prevImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (allImages.length === 0) return;
    setCurrentImgIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1));
  };

  const nextImage = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (allImages.length === 0) return;
    setCurrentImgIndex((prev) => (prev + 1) % allImages.length);
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
    const minSwipeDistance = 35;

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
    trackAddToCart(product, orderQty, defaultSub);
    addToast(`${product.title} added to cart successfully.`, "success");
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  if (layout === "list") {
    return (
      <Card 
        onClick={handleCardClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="flex flex-col sm:flex-row w-full bg-card hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative group/card border border-border/80 cursor-pointer select-none rounded-xl overflow-hidden"
      >
        {/* Wishlist Button */}
        <button 
          type="button"
          onClick={handleWishlistToggle}
          className="absolute top-3 right-3 z-20 bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive p-2 rounded-full shadow-md backdrop-blur-xs transition-transform active:scale-95 cursor-pointer"
          title="Toggle Wishlist"
        >
          <Heart className={`h-4 w-4 transition-colors ${favorited ? "fill-destructive text-destructive" : ""}`} />
        </button>

        {/* Left Side: Image Viewport */}
        <div 
          className="w-full sm:w-52 sm:h-52 aspect-square relative bg-secondary/20 overflow-hidden shrink-0 border-b sm:border-b-0 sm:border-r select-none touch-pan-y"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Overlay Badges */}
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

          {allImages.length > 0 ? (
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
                    sizes="(max-width: 640px) 100vw, 208px"
                    className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center text-xs text-muted-foreground font-semibold">
              No Image
            </div>
          )}

          {/* Carousel Arrow Controls */}
          {allImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer shadow"
                title="Previous Image"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer shadow"
                title="Next Image"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* MOQ Badge */}
          {((pureB2B || (Array.isArray(effectiveTierOrTypes) && effectiveTierOrTypes.includes("B2B"))) && defaultSub?.b2bMoq && defaultSub.b2bMoq > 1) && (
            <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded z-20 shadow-xs">
              MOQ: {defaultSub.b2bMoq} pcs
            </div>
          )}
        </div>

        {/* Right Side: Details & Actions */}
        <CardContent className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-4">
          <div className="space-y-2 pr-8">
            <h3 
              className="font-extrabold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors leading-snug" 
              title={product.title}
            >
              {truncatedTitle}
            </h3>

            {/* 5-Star Rating System */}
            {(product.reviewCount ?? 0) >= 1 && (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex items-center text-amber-400">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const ratingVal = product.rating || 0;
                    const isFull = ratingVal >= starIdx;
                    const isHalf = !isFull && ratingVal >= starIdx - 0.5;

                    return (
                      <Star
                        key={starIdx}
                        className={`h-4 w-4 ${
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
                  {(product.rating || 0).toFixed(1)}
                </span>
                <span className="text-xs text-muted-foreground font-normal">
                  ({product.reviewCount} reviews)
                </span>
              </div>
            )}

            {/* Tags / Specifications */}
            {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.slice(0, 4).map((tag, idx) => (
                  <span key={idx} className="bg-secondary/40 text-muted-foreground text-[10px] font-semibold px-2 py-0.5 rounded border border-border/50">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Price & Add to Cart Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/50 mt-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-primary">{formatPrice(price)}</span>
              {mrp > price && (
                <span className="text-xs text-muted-foreground line-through font-medium">{formatPrice(mrp)}</span>
              )}
            </div>

            <Button 
              className="w-full sm:w-auto font-bold flex items-center justify-center gap-2 cursor-pointer text-xs h-9 px-5 flex-shrink-0" 
              size="sm"
              onClick={handleAddToCart}
              disabled={product.totalStock <= 0 || !purchaseAllowed}
            >
              <ShoppingCart className="h-4 w-4" />
              {product.totalStock <= 0 ? "Out of Stock" : !purchaseAllowed ? "Dropship Only" : "Add to Cart"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      onClick={handleCardClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex flex-col h-full bg-card hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative group/card border border-border/80 cursor-pointer select-none rounded-xl overflow-hidden max-w-sm w-full mx-auto"
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
        {allImages.length > 0 ? (
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
                  className="object-cover transition-transform duration-500 group-hover/card:scale-105"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full bg-secondary flex items-center justify-center text-xs text-muted-foreground font-semibold">
            No Image
          </div>
        )}

        {/* Carousel Arrow Controls */}
        {allImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer shadow"
              title="Previous Image"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white p-1 rounded-full opacity-0 group-hover/card:opacity-100 transition-opacity cursor-pointer shadow"
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
        {((pureB2B || (Array.isArray(effectiveTierOrTypes) && effectiveTierOrTypes.includes("B2B"))) && defaultSub?.b2bMoq && defaultSub.b2bMoq > 1) && (
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

          {/* Industry Level 5-Star Filled Rating System - Rendered dynamically only if at least 1 review is available */}
          {(product.reviewCount ?? 0) >= 1 && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <div className="flex items-center text-amber-400">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const ratingVal = product.rating || 0;
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
                {(product.rating || 0).toFixed(1)}
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">
                ({product.reviewCount})
              </span>
            </div>
          )}
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
