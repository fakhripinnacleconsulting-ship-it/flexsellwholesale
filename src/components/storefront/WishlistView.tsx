"use client";

import * as React from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWishlistStore } from "@/stores/wishlistStore";
import { ProductCard } from "./ProductCard";

export function WishlistView() {
  const { items, syncWithDb } = useWishlistStore();

  React.useEffect(() => {
    syncWithDb();
  }, [syncWithDb]);

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-8 w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">My Wishlist</h1>
        <p className="text-muted-foreground mt-1">Saved items you might want to purchase later.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Looks like you haven't added any products to your wishlist yet."
          actionText="Browse Products"
          actionHref="/products"
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((product) => (
            <ProductCard key={product._id} product={product} layout="grid" />
          ))}
        </div>
      )}
    </div>
  );
}
