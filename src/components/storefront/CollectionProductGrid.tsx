"use client";

import * as React from "react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { InfiniteScrollTrigger } from "@/components/ui/InfiniteScrollTrigger";
import { AlertCircle } from "lucide-react";

interface Props {
  initialProducts: any[];
}

export function CollectionProductGrid({ initialProducts }: Props) {
  const [displayedPages, setDisplayedPages] = React.useState(1);
  const ITEMS_PER_PAGE = 40;

  const totalPages = Math.ceil(initialProducts.length / ITEMS_PER_PAGE);

  const paginatedProducts = React.useMemo(() => {
    return initialProducts.slice(0, displayedPages * ITEMS_PER_PAGE);
  }, [initialProducts, displayedPages]);

  if (initialProducts.length === 0) {
    return (
      <div className="text-center py-24 border border-dashed rounded-3xl bg-secondary/5">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="font-bold text-foreground">No Products Found</p>
        <p className="text-xs text-muted-foreground mt-1">This collection does not contain any catalog lines at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {paginatedProducts.map((product: any) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
      <InfiniteScrollTrigger
        hasMore={displayedPages < totalPages}
        onIntersect={() => setDisplayedPages(p => p + 1)}
      />
    </div>
  );
}
