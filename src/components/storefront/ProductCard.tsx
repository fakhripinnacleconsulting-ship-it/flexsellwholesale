"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart, Minus, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Product } from "@/types";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { formatPrice, sanitizeImgUrl } from "@/lib/utils";
import { useToastStore } from "@/stores/toastStore";
import { useAuthStore } from "@/stores/authStore";
import { resolvePrice, canPurchase, resolveMoq } from "@/lib/priceTierHelper";
import { motion } from "framer-motion";

interface ProductCardProps {
  product: Product;
  layout?: "grid" | "list";
}

export function ProductCard({ product, layout = "grid" }: ProductCardProps) {
  const { addItem } = useCartStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addToast } = useToastStore();
  const customer = useAuthStore((state: any) => state.customer);

  const [qty, setQty] = React.useState(1);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const favorited = isMounted ? isInWishlist(product._id) : false;
  const defaultVariant = product.colorVariants?.[0];
  const defaultSub = defaultVariant?.subVariants?.[0];

  // Primary image
  const firstImg = defaultVariant?.images?.[0];
  const rawImgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
  const imgUrl = sanitizeImgUrl(rawImgUrl);

  // Hover/Secondary image
  const secondImg = defaultVariant?.images?.[1];
  const rawSecondImgUrl = secondImg ? (typeof secondImg === "string" ? secondImg : secondImg.url || "") : "";
  const secondImgUrl = rawSecondImgUrl ? sanitizeImgUrl(rawSecondImgUrl) : "";

  let activeTier: "B2C" | "B2B" | "Dropshipping" = product.defaultPriceTier || "B2C";
  let activeCartTier: "B2C" | "B2B" = "B2C";
  if (customer && customer.customerTypes && customer.customerTypes.length > 0) {
    if (customer.customerTypes.includes("B2C")) {
      activeTier = "B2C";
      activeCartTier = "B2C";
    } else if (customer.customerTypes.includes("B2B")) {
      activeTier = "B2B";
      activeCartTier = "B2B";
    } else {
      activeTier = "Dropshipping";
    }
  }

  const purchaseAllowed = !customer || canPurchase(customer.customerTypes);
  const price = defaultSub ? resolvePrice(defaultSub, activeTier) : 0;
  const mrp = defaultSub?.mrp ?? 0;
  const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const sku = defaultSub?.sku || "NO SKU";

  const isBestseller = product.cardTags?.some(tag => tag.toLowerCase() === "bestseller" || tag.toLowerCase() === "best seller");
  const [isNew, setIsNew] = React.useState(() =>
    !!product.cardTags?.some(tag => tag.toLowerCase() === "new")
  );
  React.useEffect(() => {
    const isTagNew = product.cardTags?.some(tag => tag.toLowerCase() === "new");
    const isDateNew = product.createdAt ? (new Date().getTime() - new Date(product.createdAt).getTime()) <= 7 * 24 * 60 * 60 * 1000 : false;
    setIsNew(!!(isTagNew || isDateNew));
  }, [product.cardTags, product.createdAt]);
  const isTrending = product.cardTags?.some(tag => tag.toLowerCase() === "trending" || tag.toLowerCase() === "hot");

  const adjustQty = (amount: number) => {
    setQty(prev => Math.max(1, prev + amount));
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!purchaseAllowed) {
      addToast("Dropshipping accounts cannot place orders directly from storefront.", "warning");
      return;
    }

    const itemMoq = defaultSub ? resolveMoq(defaultSub, activeCartTier) : 1;
    let orderQty = qty;
    if (orderQty < itemMoq) {
      addToast(`MOQ required. Standard limit is at least ${itemMoq} units.`, "warning");
      orderQty = itemMoq;
      setQty(itemMoq);
    }

    addItem(
      product,
      {
        Color: defaultVariant?.color || "Standard",
        Size: defaultSub?.size || "Standard",
        Weight: defaultSub?.weight || "250g"
      },
      orderQty,
      activeCartTier
    );
    addToast(`${product.title} added to cart successfully.`, "success");
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product);
  };

  if (layout === "list") {
    return (
      <div className="flex flex-col sm:flex-row items-center border border-border rounded-xl p-4 gap-6 bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300 relative group text-foreground w-full">
        {/* Wishlist Button */}
        <button 
          onClick={handleWishlistToggle}
          className="absolute top-4 right-4 bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive p-1.5 rounded-full shadow transition-colors z-10"
        >
          <Heart className={`h-4 w-4 ${favorited ? "fill-destructive text-destructive" : ""}`} />
        </button>

        {/* Product Image */}
        <div className="w-24 h-24 rounded-lg bg-secondary border overflow-hidden flex-shrink-0 relative">
          <Link href={`/products/${product.slug}`}>
            <div className="w-full h-full relative">
              <Image 
                src={imgUrl || "https://placehold.co/400x400/10b981/ffffff?text=Product"} 
                alt={product.title} 
                fill 
                sizes="96px" 
                className={`object-cover transition-opacity duration-500 ${secondImgUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`} 
              />
              {secondImgUrl && (
                <Image 
                  src={secondImgUrl} 
                  alt={product.title} 
                  fill 
                  sizes="96px" 
                  className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
                />
              )}
            </div>
          </Link>
          {discount > 0 && (
            <div className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[8px] font-extrabold px-1 rounded shadow">
              {discount}% OFF
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          <div className="space-y-0.5">
            <Link href={`/products/${product.slug}`} className="hover:text-primary transition-colors">
              <h3 className="font-bold text-base line-clamp-1 text-foreground">{product.title}</h3>
            </Link>
            <p className="text-xs font-mono text-muted-foreground">SKU: {sku}</p>
            {product.cardTags && product.cardTags.length > 0 && (
              <div className="flex flex-wrap justify-center sm:justify-start gap-1 pt-1">
                {product.cardTags.map((tag, tIdx) => (
                  <span key={tIdx} className="bg-secondary text-muted-foreground text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

        {/* List Layout MOQ */}
        <div className="flex items-center gap-3 justify-center sm:justify-start">
          {product.totalStock <= 0 && (
            <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
              Out of Stock
            </span>
          )}
          {(customer?.customerTypes?.includes("B2B") && defaultSub?.b2bMoq) && (
            <span className="text-xs text-muted-foreground">B2B MOQ: {defaultSub.b2bMoq} units</span>
          )}
        </div>
        </div>

        {/* Pricing Column */}
        <div className="text-center sm:text-left flex-shrink-0">
          <div className="flex items-baseline gap-1.5 justify-center sm:justify-start">
            <span className="text-xl font-extrabold text-primary">{formatPrice(price)}</span>
            {mrp > price && (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(mrp)}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
            {product.priceIncludesGst ? "Incl. GST" : `+ ${product.gstRate || 18}% GST (Excl.)`}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-2 w-full sm:w-48 flex-shrink-0">
          <div className="flex items-center gap-1.5 border rounded-lg p-0.5 bg-secondary/10 w-full justify-between">
            <button
              type="button"
              onClick={() => adjustQty(-1)}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              className="w-12 text-center text-xs font-bold bg-transparent border-none outline-none focus:ring-0 text-foreground"
            />
            <button
              type="button"
              onClick={() => adjustQty(1)}
              className="p-1 rounded hover:bg-secondary transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <Button 
            className="w-full flex items-center justify-center gap-2 font-bold" 
            size="sm"
            onClick={handleAddToCart}
            disabled={product.totalStock <= 0 || !purchaseAllowed}
          >
            <ShoppingCart className="h-4 w-4" />
            {!purchaseAllowed ? "Dropship Only" : "Add to Cart"}
          </Button>
        </div>
      </div>
    );
  }

  // Grid Layout
  return (
    <Card className="flex flex-col h-full bg-card hover:shadow-lg hover:border-primary/20 transition-all duration-300 relative group border border-border">
      {/* Floating Badges */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
        {discount > 0 && (
          <span className="bg-destructive text-destructive-foreground text-[10px] font-extrabold px-2 py-0.5 rounded shadow uppercase">
            {discount}% OFF
          </span>
        )}
        {isBestseller && (
          <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow uppercase">
            BEST SELLER
          </span>
        )}
        {isNew && (
          <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow uppercase">
            NEW
          </span>
        )}
        {isTrending && (
          <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow uppercase">
            TRENDING
          </span>
        )}
      </div>

      {/* Wishlist Button */}
      <button 
        onClick={handleWishlistToggle}
        className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background text-muted-foreground hover:text-destructive p-1.5 rounded-full shadow transition-colors"
      >
        <Heart className={`h-4 w-4 ${favorited ? "fill-destructive text-destructive" : ""}`} />
      </button>

      {/* Image Viewport with Hover transition */}
      <div className="aspect-square relative bg-secondary overflow-hidden rounded-t-lg border-b">
        <Link href={`/products/${product.slug}`}>
          <div className="w-full h-full relative">
            <Image
              src={imgUrl || "https://placehold.co/400x400/10b981/ffffff?text=Product"}
              alt={product.title}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className={`object-cover transition-all duration-500 ${secondImgUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
            />
            {secondImgUrl && (
              <Image
                src={secondImgUrl}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
            )}
          </div>
        </Link>
        {(customer?.customerTypes?.includes("B2B") && defaultSub?.b2bMoq) && (
          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] font-mono px-1 rounded z-10">
            MOQ: {defaultSub.b2bMoq} pcs
          </div>
        )}
      </div>

      <CardContent className="p-4 flex flex-col flex-1 gap-3">
        <div className="space-y-1">
          <Link href={`/products/${product.slug}`} className="hover:text-primary transition-colors">
            <h3 className="font-bold text-sm line-clamp-2 text-foreground" title={product.title}>
              {product.title}
            </h3>
          </Link>
          <p className="text-[10px] font-mono text-muted-foreground">SKU: {sku}</p>
          
          {product.cardTags && product.cardTags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {product.cardTags.slice(0, 3).map((tag, tIdx) => (
                <span key={tIdx} className="bg-secondary text-muted-foreground text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Stock Level meter */}
        <div>
          {product.totalStock <= 0 && (
            <span className="text-[11px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
              Out of Stock
            </span>
          )}
        </div>

        {/* B2B Pricing Details */}
        <div className="pt-2 border-t mt-auto space-y-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-primary">{formatPrice(price)}</span>
              {mrp > price && (
                <span className="text-xs text-muted-foreground line-through">{formatPrice(mrp)}</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-semibold">
              {product.priceIncludesGst ? "Incl. GST" : `+ ${product.gstRate || 18}% GST (Excl.)`}
            </span>
          </div>

          {/* Bulk quantity counters */}
          <div className="flex items-center gap-1.5 border rounded-lg p-0.5 bg-secondary/10 w-full justify-between">
            <button
              type="button"
              onClick={() => adjustQty(-1)}
              className="p-1 rounded-md hover:bg-secondary transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-xs font-mono font-bold px-2">{qty}</span>
            <button
              type="button"
              onClick={() => adjustQty(1)}
              className="p-1 rounded-md hover:bg-secondary transition-colors"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <Button 
            className="w-full font-bold flex items-center justify-center gap-1.5" 
            size="sm"
            onClick={handleAddToCart}
            disabled={product.totalStock <= 0 || !purchaseAllowed}
          >
            <ShoppingCart className="h-4 w-4" /> {!purchaseAllowed ? "Dropship Only" : "Add to Cart"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
