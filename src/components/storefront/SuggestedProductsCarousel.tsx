"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingCart, Sparkles, Star, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "@/stores/cartStore";
import { useProductStore } from "@/stores/productStore";
import { useToastStore } from "@/stores/toastStore";
import { Product } from "@/types";

export function SuggestedProductsCarousel() {
  const { items, addItem } = useCartStore();
  const { products, initializeProducts } = useProductStore();
  const { addToast } = useToastStore();

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const [addedProductId, setAddedProductId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (products.length === 0) {
      initializeProducts();
    }
  }, [products.length, initializeProducts]);

  // Compute suggested products based on cart items
  const suggestedProducts = React.useMemo(() => {
    if (products.length === 0) return [];

    const cartProductIds = new Set(items.map((i) => i.productId));
    const cartCategories = new Set(
      items
        .map((i) => {
          const p = i.product as any;
          if (!p) return null;
          if (typeof p.category === "object" && p.category?._id) return p.category._id;
          return p.categoryId || p.category;
        })
        .filter(Boolean)
    );

    const getProdCatId = (p: any) => {
      if (typeof p.category === "object" && p.category?._id) return p.category._id;
      return p.categoryId || p.category;
    };

    // 1. Related category matches not in cart
    const categoryMatches = products.filter((p) => {
      if (cartProductIds.has(p._id)) return false;
      const catId = getProdCatId(p);
      return cartCategories.has(catId);
    });

    // 2. Remaining products not in cart
    const otherProducts = products.filter((p) => {
      if (cartProductIds.has(p._id)) return false;
      const catId = getProdCatId(p);
      return !cartCategories.has(catId);
    });

    // Combine and limit to 10 products
    const combined = [...categoryMatches, ...otherProducts];
    return combined.slice(0, 10);
  }, [products, items]);

  if (suggestedProducts.length === 0) return null;

  const cardWidth = 260; // Card width step

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  };

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

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const defaultVariant = product.colorVariants?.[0];
    const defaultSubVariant = defaultVariant?.subVariants?.[0];

    if (!defaultVariant || !defaultSubVariant) {
      addToast("Please open product page to select variants", "warning");
      return;
    }

    const selectedVariants: Record<string, string> = {};
    if (defaultVariant.color) selectedVariants["Color"] = defaultVariant.color;
    if (defaultSubVariant.size) selectedVariants["Size"] = defaultSubVariant.size;
    if (defaultSubVariant.weight) selectedVariants["Weight"] = defaultSubVariant.weight;

    addItem(product, selectedVariants, 1, "B2C");
    setAddedProductId(product._id);
    addToast(`Added "${product.title}" to your cart!`, "success");

    setTimeout(() => setAddedProductId(null), 2000);
  };

  return (
    <div className="w-full py-6 mt-6 border-t border-border select-none">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500/20" /> Suggested Add-Ons For Your Cart
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Handpicked items matching your current selections.
          </p>
        </div>

        {/* Carousel Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={scrollLeft}
            className="p-2 rounded-full border bg-card hover:bg-secondary text-foreground shadow-sm transition-all cursor-pointer"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollRight}
            className="p-2 rounded-full border bg-card hover:bg-secondary text-foreground shadow-sm transition-all cursor-pointer"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Suggested Products Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onDragStart={(e) => e.preventDefault()}
        className={`flex gap-4 overflow-x-auto scrollbar-none pb-2 pt-1 touch-pan-x ${
          isMouseDown ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        {suggestedProducts.map((product) => {
          const firstVariant = product.colorVariants?.[0];
          const firstSubVariant = firstVariant?.subVariants?.[0];
          const firstImg = firstVariant?.images?.[0];
          const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
          const price = firstSubVariant?.b2cPrice || firstSubVariant?.b2bPrice || 0;
          const wholesalePrice = firstSubVariant?.b2bPrice || price;
          const isAdded = addedProductId === product._id;

          return (
            <Card
              key={product._id}
              className="w-[240px] flex-shrink-0 border-border hover:border-primary/50 transition-all hover:shadow-md overflow-hidden bg-card flex flex-col justify-between group"
            >
              <Link href={`/products/${product.slug}`} draggable={false} className="block flex-1">
                <div className="aspect-square relative bg-secondary overflow-hidden">
                  <Image
                    src={imgUrl || "https://placehold.co/400x400/10b981/ffffff?text=Product"}
                    alt={product.title}
                    fill
                    draggable={false}
                    sizes="240px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                  />
                  {product.rating && (
                    <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {product.rating}
                    </span>
                  )}
                </div>

                <div className="p-3 space-y-1">
                  <h4 className="font-bold text-xs text-foreground line-clamp-2 leading-snug">
                    {product.title}
                  </h4>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-black text-sm text-primary">{formatPrice(price)}</span>
                    {wholesalePrice < price && (
                      <span className="text-[10px] text-muted-foreground line-through">
                        {formatPrice(wholesalePrice)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>

              {/* 1-Click Quick Add Button */}
              <div className="p-3 pt-0 mt-auto">
                <Button
                  size="sm"
                  variant={isAdded ? "default" : "outline"}
                  onClick={(e) => handleQuickAdd(product, e)}
                  className={`w-full text-xs font-bold gap-1.5 cursor-pointer ${
                    isAdded ? "bg-emerald-600 text-white" : "border-primary/30 text-primary hover:bg-primary/5"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Added!
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
