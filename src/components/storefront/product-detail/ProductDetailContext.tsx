"use client";

import * as React from "react";
import { Product, ColorVariant } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useCartStore } from "@/stores/cartStore";
import { useToastStore } from "@/stores/toastStore";
import { reviewService } from "@/services/reviewService";
import { customerService } from "@/services/customerService";
import { apiClient } from "@/lib/apiClient";

/** Shape returned by /api/products/stock — stock only, nothing else. */
interface LiveStockEntry {
  _id: string;
  totalStock: number;
  isActive: boolean;
  variants: Array<{ id?: string; sku?: string; stock: number; isActive: boolean }>;
}

interface ProductDetailContextProps {
  slug: string;
  product: Product | null;
  /**
   * False until the live stock lookup settles (success or failure). Purchase controls
   * stay disabled while false so a buyer cannot act on a stale figure. On failure this
   * flips true anyway — cached stock is better than a permanently dead button.
   */
  isStockResolved: boolean;
  toggleWishlist: (product: Product) => void;
  isInWishlist: (id: string) => boolean;
  isDescExpanded: boolean;
  setIsDescExpanded: (b: boolean) => void;
  recentProducts: Product[];
  relatedProducts: Product[];
  otherProducts: Product[];
  selectedColorIdx: number;
  setSelectedColorIdx: (n: number) => void;
  selectedSize: string;
  setSelectedSize: (s: string) => void;
  selectedWeight: string;
  setSelectedWeight: (w: string) => void;
  qty: number;
  setQty: (n: number) => void;
  activeImageIdx: number;
  setActiveImageIdx: (n: number) => void;
  reviewsList: any[];
  isReviewsLoading: boolean;
  activeUser: any;
  reviewRating: number;
  setReviewRating: (n: number) => void;
  reviewTitle: string;
  setReviewTitle: (s: string) => void;
  reviewComment: string;
  setReviewComment: (s: string) => void;
  isSubmittingReview: boolean;
  orderMode: "single" | "bulk";
  setOrderMode: (m: "single" | "bulk") => void;
  bulkQuantities: Record<string, number>;
  setBulkQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  activeVariant: ColorVariant | null;
  activeSubVariant: any;
  uniqueSizes: string[];
  uniqueWeights: string[];
  qtyInputRef: React.RefObject<HTMLInputElement | null>;
  handleBulkQtyChange: (subVariantId: string, valStr: string, svStock: number) => void;
  handleAddBulkToCart: () => void;
  handleSubmitReview: (e: React.FormEvent) => Promise<void>;
  fetchReviews: () => Promise<void>;
}

const ProductDetailContext = React.createContext<ProductDetailContextProps | undefined>(undefined);

export function ProductDetailProvider({
  children,
  slug,
  initialProduct,
  initialProducts
}: {
  children: React.ReactNode;
  slug: string;
  initialProduct?: Product | null;
  initialProducts: Product[];
}) {
  const { products, initializeProducts } = useProductStore();
  const { toggleWishlist, isInWishlist } = useWishlistStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);
  const [recentProducts, setRecentProducts] = React.useState<Product[]>([]);
  const [fetchedProduct, setFetchedProduct] = React.useState<Product | null>(initialProduct || null);

  React.useEffect(() => {
    initializeProducts(initialProducts);
  }, [initialProducts, initializeProducts]);

  /**
   * The route identifier is the product **id** now, not its title-slug.
   *
   * So every comparison here matches on either. Testing only `slug` meant the guard below
   * never recognised the product the server had already sent, which triggered an
   * unnecessary refetch on every load — and then discarded its result for the same reason,
   * surfacing as "Product not found".
   */
  const matchesIdentifier = React.useCallback(
    (p: Product | null | undefined) => Boolean(p && (p._id === slug || p.slug === slug)),
    [slug]
  );

  React.useEffect(() => {
    if (matchesIdentifier(initialProduct)) {
      setFetchedProduct(initialProduct!);
    } else {
      const { productService } = require("@/services/productService");
      productService
        .getProductBySlug(slug)
        .then((p: Product) => setFetchedProduct(p))
        .catch((err: any) => console.error("Client product lookup notice:", err));
    }
  }, [slug, initialProduct, matchesIdentifier]);

  const activeProducts = React.useMemo(() => {
    const list = products.length > 0 ? products : initialProducts;
    const current = fetchedProduct || initialProduct;
    if (current && !list.some((p) => p._id === current._id || p.slug === current.slug)) {
      return [current, ...list];
    }
    return list;
  }, [products, initialProducts, fetchedProduct, initialProduct]);

  // The product as rendered from cache. Product HTML is cached with a long revalidate
  // window, so its stock figures can be stale — `product` below overlays live stock on
  // top of this once the on-demand lookup resolves.
  const baseProduct = React.useMemo(() => {
    if (matchesIdentifier(fetchedProduct)) return fetchedProduct;
    if (matchesIdentifier(initialProduct)) return initialProduct;
    return activeProducts.find((p) => matchesIdentifier(p)) || null;
  }, [fetchedProduct, initialProduct, activeProducts, matchesIdentifier]);

  // Live stock, fetched on demand so order activity never has to purge cached HTML.
  const [liveStock, setLiveStock] = React.useState<LiveStockEntry | null>(null);
  const [isStockResolved, setIsStockResolved] = React.useState(false);

  React.useEffect(() => {
    const productId = baseProduct?._id;
    if (!productId) return;

    let cancelled = false;
    setIsStockResolved(false);

    apiClient
      .get<{ stock: LiveStockEntry[] }>(`/products/stock?ids=${encodeURIComponent(productId)}`)
      .then((res) => {
        if (cancelled) return;
        const entry = res?.stock?.find((s) => s._id === productId) || null;
        setLiveStock(entry);
      })
      .catch(() => {
        // Non-fatal: fall back to the cached figures. /api/orders re-checks stock at
        // order time, so this is a display concern, never the oversell guard.
      })
      .finally(() => {
        if (!cancelled) setIsStockResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, [baseProduct?._id]);

  const product = React.useMemo(() => {
    if (!baseProduct) return null;
    if (!liveStock || liveStock._id !== baseProduct._id) return baseProduct;

    const byId = new Map((liveStock.variants || []).map((v) => [v.id, v]));
    const bySku = new Map((liveStock.variants || []).filter((v) => v.sku).map((v) => [v.sku, v]));

    return {
      ...baseProduct,
      totalStock: liveStock.totalStock,
      colorVariants: baseProduct.colorVariants?.map((cv) => ({
        ...cv,
        subVariants: cv.subVariants?.map((sv) => {
          const live = byId.get(sv.id) ?? (sv.sku ? bySku.get(sv.sku) : undefined);
          return live ? { ...sv, stock: live.stock } : sv;
        }),
      })),
    } as Product;
  }, [baseProduct, liveStock]);

  // Load and update recently viewed products on client mount
  React.useEffect(() => {
    if (!product) return;
    try {
      const { addToRecentlyViewed } = require("@/lib/recentlyViewedTracker");
      addToRecentlyViewed(product._id);

      const list = JSON.parse(localStorage.getItem("flexsell-recently-viewed") || "[]");
      const recentItems = list
        .filter((id: string) => id !== product._id)
        .map((id: string) => activeProducts.find((p) => p._id === id))
        .filter(Boolean) as Product[];
      setRecentProducts(recentItems);
    } catch (e) {
      console.error(e);
    }
  }, [product, activeProducts]);

  // Related products (same category, excluding current)
  const relatedProducts = React.useMemo(() => {
    if (!product) return [];
    return activeProducts.filter(p => p.categoryId === product.categoryId && p._id !== product._id);
  }, [product, activeProducts]);

  // Other products (catalog popular items, excluding current and related)
  const otherProducts = React.useMemo(() => {
    if (!product) return [];
    const relatedIds = relatedProducts.map(p => p._id);
    return activeProducts.filter(p => p._id !== product._id && !relatedIds.includes(p._id));
  }, [product, activeProducts, relatedProducts]);

  // Selector States
  const [selectedColorIdx, setSelectedColorIdx] = React.useState(0);
  const [selectedSize, setSelectedSize] = React.useState("");
  const [selectedWeight, setSelectedWeight] = React.useState("");
  const [qty, setQty] = React.useState(1);
  const [activeImageIdx, setActiveImageIdx] = React.useState(0);

  // Reviews state variables
  const [reviewsList, setReviewsList] = React.useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = React.useState(true);
  const [activeUser, setActiveUser] = React.useState<any>(null);
  
  // Submit review form state variables
  const [reviewRating, setReviewRating] = React.useState(5);
  const [reviewTitle, setReviewTitle] = React.useState("");
  const [reviewComment, setReviewComment] = React.useState("");
  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);

  const fetchReviews = async () => {
    try {
      setIsReviewsLoading(true);
      if (product?._id) {
        const data = await reviewService.getProductReviews(product._id);
        setReviewsList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsReviewsLoading(false);
    }
  };

  React.useEffect(() => {
    if (!product) return;
    fetchReviews();
    
    // Check if customer is authenticated
    customerService.getActiveCustomer()
      .then(data => setActiveUser(data))
      .catch(() => setActiveUser(null));
  }, [product]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTitle || !reviewComment || !product?._id) {
      addToast("Please fill out all review fields.", "warning");
      return;
    }
    setIsSubmittingReview(true);
    try {
      await reviewService.submitReview({
        productId: product._id,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment
      });
      
      addToast("Review submitted successfully! It is pending administrator approval.", "success");
      setReviewTitle("");
      setReviewComment("");
      setReviewRating(5);
      fetchReviews();
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to submit review", "error");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // B2B Bulk Mode States
  const [orderMode, setOrderMode] = React.useState<"single" | "bulk">("single");
  const [bulkQuantities, setBulkQuantities] = React.useState<Record<string, number>>({});

  const handleBulkQtyChange = (subVariantId: string, valStr: string, svStock: number) => {
    const val = parseInt(valStr, 10);
    
    const { resolveMoq, resolveCustomerTier } = require("@/lib/priceTierHelper");
    const userTier = resolveCustomerTier(activeUser?.customerTypes);
    const tier = userTier === "B2B" ? "B2B" : "B2C";
    const subVariant = activeVariant?.subVariants?.find(sv => sv.id === subVariantId);
    const moqLimit = subVariant ? resolveMoq(subVariant, tier) : 1;

    if (isNaN(val) || val <= 0) {
      setBulkQuantities(prev => {
        const copy = { ...prev };
        delete copy[subVariantId];
        return copy;
      });
      return;
    }

    let target = val;
    if (target < moqLimit) target = moqLimit;
    if (target > svStock) target = svStock;

    setBulkQuantities(prev => ({
      ...prev,
      [subVariantId]: target
    }));
  };

  const handleAddBulkToCart = () => {
    if (!product) return;
    let addedCount = 0;

    const { resolveCustomerTier } = require("@/lib/priceTierHelper");
    const userTier = resolveCustomerTier(activeUser?.customerTypes);
    const tier = userTier === "B2B" ? "B2B" : "B2C";

    product.colorVariants?.forEach(cv => {
      cv.subVariants?.forEach(sv => {
        const targetQty = bulkQuantities[sv.id] || 0;
        if (targetQty > 0) {
          addItem(
            product,
            {
              Color: cv.color,
              Size: sv.size,
              Weight: sv.weight
            },
            targetQty,
            tier
          );
          addedCount++;
        }
      });
    });

    if (addedCount > 0) {
      addToast(`Successfully added ${addedCount} variant combinations to cart!`, "success");
      setBulkQuantities({});
    } else {
      addToast("Please input valid order quantities.", "warning");
    }
  };

  // Quantity input element ref
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  // Derive active color line details
  const activeVariant = React.useMemo(() => {
    if (!product || !product.colorVariants) return null;
    return product.colorVariants[selectedColorIdx] || product.colorVariants[0];
  }, [product, selectedColorIdx]);

  // Derive active specific combination (subvariant)
  const activeSubVariant = React.useMemo(() => {
    if (!activeVariant || !activeVariant.subVariants) return null;
    return activeVariant.subVariants.find(sv =>
      sv.isActive !== false &&
      (!selectedSize || sv.size === selectedSize) &&
      (!selectedWeight || sv.weight === selectedWeight)
    ) || activeVariant.subVariants.find(sv => sv.isActive !== false) || activeVariant.subVariants[0];
  }, [activeVariant, selectedSize, selectedWeight]);

  // Derive unique sizes and weights for the current color variant
  const uniqueSizes = React.useMemo(() => {
    if (!activeVariant || !activeVariant.subVariants) return [];
    return Array.from(new Set(activeVariant.subVariants.filter(sv => sv.isActive !== false).map(sv => sv.size))).filter(Boolean);
  }, [activeVariant]);

  const uniqueWeights = React.useMemo(() => {
    if (!activeVariant || !activeVariant.subVariants) return [];
    return Array.from(new Set(activeVariant.subVariants.filter(sv => sv.isActive !== false).map(sv => sv.weight))).filter(Boolean);
  }, [activeVariant]);

  // Reset secondary selections on color changes
  React.useEffect(() => {
    if (uniqueSizes.length > 0) setSelectedSize(uniqueSizes[0]);
    if (uniqueWeights.length > 0) setSelectedWeight(uniqueWeights[0]);
    setActiveImageIdx(0);
    setQty(1);
  }, [selectedColorIdx, activeVariant, product]);

  // Synchronize size and weight selection to ensure it corresponds to a valid sub-variant
  React.useEffect(() => {
    if (!activeVariant || !activeVariant.subVariants) return;

    const isValidCombination = activeVariant.subVariants.some(sv =>
      sv.isActive !== false && sv.size === selectedSize && sv.weight === selectedWeight
    );

    if (!isValidCombination) {
      const matchingSize = activeVariant.subVariants.find(sv => sv.isActive !== false && sv.size === selectedSize);
      if (matchingSize) {
        setSelectedWeight(matchingSize.weight);
      } else {
        const matchingWeight = activeVariant.subVariants.find(sv => sv.isActive !== false && sv.weight === selectedWeight);
        if (matchingWeight) {
          setSelectedSize(matchingWeight.size);
        } else {
          const firstActive = activeVariant.subVariants.find(sv => sv.isActive !== false);
          if (firstActive) {
            setSelectedSize(firstActive.size);
            setSelectedWeight(firstActive.weight);
          }
        }
      }
    }
  }, [selectedSize, selectedWeight, activeVariant]);

  return (
    <ProductDetailContext.Provider value={{
      slug,
      product,
      isStockResolved,
      toggleWishlist,
      isInWishlist,
      isDescExpanded,
      setIsDescExpanded,
      recentProducts,
      relatedProducts,
      otherProducts,
      selectedColorIdx,
      setSelectedColorIdx,
      selectedSize,
      setSelectedSize,
      selectedWeight,
      setSelectedWeight,
      qty,
      setQty,
      activeImageIdx,
      setActiveImageIdx,
      reviewsList,
      isReviewsLoading,
      activeUser,
      reviewRating,
      setReviewRating,
      reviewTitle,
      setReviewTitle,
      reviewComment,
      setReviewComment,
      isSubmittingReview,
      orderMode,
      setOrderMode,
      bulkQuantities,
      setBulkQuantities,
      activeVariant,
      activeSubVariant,
      uniqueSizes,
      uniqueWeights,
      qtyInputRef,
      handleBulkQtyChange,
      handleAddBulkToCart,
      handleSubmitReview,
      fetchReviews
    }}>
      {children}
    </ProductDetailContext.Provider>
  );
}

export function useProductDetail() {
  const context = React.useContext(ProductDetailContext);
  if (!context) {
    throw new Error("useProductDetail must be used within a ProductDetailProvider");
  }
  return context;
}
