"use client";

import * as React from "react";
import { Product } from "@/types";
import { useProductStore } from "@/stores/productStore";
import { ProductCard } from "./ProductCard";
import { Pagination } from "@/components/ui/Pagination";

interface TrendingProductsProps {
  initialProducts: Product[];
}

export function TrendingProducts({ initialProducts }: TrendingProductsProps) {
  const { products, initializeProducts } = useProductStore();

  React.useEffect(() => {
    initializeProducts(initialProducts);
  }, [initialProducts, initializeProducts]);

  const activeProducts = products.length > 0 ? products : initialProducts;
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 5;

  const totalPages = Math.ceil(activeProducts.length / ITEMS_PER_PAGE);

  const paginatedTrending = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return activeProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [activeProducts, currentPage]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {paginatedTrending.map((product) => (
          <ProductCard key={product._id} product={product} layout="grid" />
        ))}
      </div>
      
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={activeProducts.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      )}
    </div>
  );
}
