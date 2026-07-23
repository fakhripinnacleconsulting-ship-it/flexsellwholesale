"use client";

import * as React from "react";
import { Product, Category } from "@/types";
import { useProductFormState, ProductFormContextProps } from "./useProductFormState";

const ProductFormContext = React.createContext<ProductFormContextProps | undefined>(undefined);

export function ProductFormProvider({
  children,
  productId,
  initialProducts,
  initialCategories
}: {
  children: React.ReactNode;
  productId?: string;
  initialProducts: Product[];
  initialCategories: Category[];
}) {
  const formState = useProductFormState(productId, initialProducts, initialCategories);

  return (
    <ProductFormContext.Provider value={formState}>
      {children}
    </ProductFormContext.Provider>
  );
}

export function useProductForm() {
  const context = React.useContext(ProductFormContext);
  if (!context) {
    throw new Error("useProductForm must be used within a ProductFormProvider");
  }
  return context;
}
