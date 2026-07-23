import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, CartItem } from "@/types";
import { useProductStore } from "./productStore";
import { useToastStore } from "./toastStore";
import { useAuthStore } from "./authStore";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { resolvePrice, resolveMoq } from "@/lib/priceTierHelper";

interface TaxBreakdown {
  hsnCode: string;
  gstRate: number;
  baseAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
}

interface CartState {
  items: CartItem[];
  buyerState: string; // Destination state (defaults to Madhya Pradesh)
  setBuyerState: (state: string) => void;
  addItem: (product: Product, selectedVariants: Record<string, string>, quantity?: number, priceTier?: "B2C" | "B2B") => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  clearCart: () => void;
  getCartSubtotal: () => number; // Sum of pricePerUnit * quantity (inclusive or exclusive based on config)
  getCartItemsCount: () => number;
  getTaxDetails: () => {
    isIntrastate: boolean;
    baseSubtotal: number;
    totalCgst: number;
    totalSgst: number;
    totalIgst: number;
    grandTotal: number;
    hsnBreakdown: Record<string, TaxBreakdown>;
  };
  hydrateProducts: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      buyerState: "",

      setBuyerState: (state) => set({ buyerState: state }),

      addItem: (product, selectedVariants, quantity = 1, priceTier = "B2C") => {
        const variantKey = Object.entries(selectedVariants)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => `${k}:${v}`)
          .join("|");

        const itemId = `${product._id}-${variantKey}-${priceTier}`;

        // Fetch active customer from authStore
        const customer = useAuthStore.getState().customer;
        
        if (customer && customer.customerTypes && customer.customerTypes.length === 1 && customer.customerTypes[0] === "Dropshipping") {
          useToastStore.getState().addToast("Dropshipping accounts cannot place orders directly from storefront.", "warning");
          return;
        }

        // Find the matched color variant from the product store for accurate stock & pricing
        const storeProducts = useProductStore.getState().products;
        const liveProduct = storeProducts.find(p => p._id === product._id) || product;

        const { color: selectedColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(selectedVariants);

        const matchedColorVariant = liveProduct.colorVariants?.find(
          cv => cv.color.toLowerCase() === selectedColor.toLowerCase()
        ) || liveProduct.colorVariants?.[0];

        let matchedVariant = null;
        if (matchedColorVariant && matchedColorVariant.subVariants) {
          matchedVariant = matchedColorVariant.subVariants.find(sv => 
            (!selectedSize || sv.size.toLowerCase() === selectedSize.toLowerCase()) && 
            (!selectedWeight || sv.weight.toLowerCase() === selectedWeight.toLowerCase())
          ) || matchedColorVariant.subVariants[0];
        }

        if (!matchedVariant) {
          useToastStore.getState().addToast("Failed to match product variant.", "error");
          return;
        }

        const calculatedPrice = resolvePrice(matchedVariant, priceTier);
        const availableStock = matchedVariant.stock;
        const moq = resolveMoq(matchedVariant, priceTier);

        // Check if item exists in cart
        const existingItem = get().items.find(item => item.id === itemId);
        const currentQty = existingItem ? existingItem.quantity : 0;
        let targetQty = currentQty + quantity;

        // Verify MOQ constraint
        if (targetQty < moq) {
          useToastStore.getState().addToast(`MOQ required. Standard limit for this product is at least ${moq} units.`, "warning");
          targetQty = moq;
        }

        // Verify Stock limit
        if (targetQty > availableStock) {
          useToastStore.getState().addToast(`Insufficient stock. Capped order at maximum available (${availableStock} units).`, "warning");
          targetQty = availableStock;
        }

        if (targetQty <= 0) {
          useToastStore.getState().addToast("Cannot add empty quantity.", "error");
          return;
        }

        set((state) => {
          const existingIndex = state.items.findIndex(item => item.id === itemId);
          const updatedItems = [...state.items];

          if (existingIndex > -1) {
            updatedItems[existingIndex].quantity = targetQty;
            useToastStore.getState().addToast(`Updated quantity in cart to ${targetQty}.`, "success");
            return { items: updatedItems };
          } else {
            useToastStore.getState().addToast(`Successfully added ${targetQty} items to cart!`, "success");
            return {
              items: [
                ...state.items,
                {
                  id: itemId,
                  productId: liveProduct._id,
                  product: liveProduct,
                  selectedVariants,
                  quantity: targetQty,
                  pricePerUnit: calculatedPrice,
                  priceTier,
                }
              ]
            };
          }
        });
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        }));
        useToastStore.getState().addToast("Item removed from wholesale cart.", "info");
      },

      updateQuantity: (itemId, qty) => {
        const item = get().items.find(i => i.id === itemId);
        if (!item) return;

        // Find live stock and MOQ boundaries
        const storeProducts = useProductStore.getState().products;
        const liveProduct = storeProducts.find(p => p._id === item.productId) || item.product;
        const { color: selectedColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(item.selectedVariants);

        const matchedColorVariant = liveProduct.colorVariants?.find(
          cv => cv.color.toLowerCase() === selectedColor.toLowerCase()
        ) || liveProduct.colorVariants?.[0];

        let matchedVariant = null;
        if (matchedColorVariant && matchedColorVariant.subVariants) {
          matchedVariant = matchedColorVariant.subVariants.find(sv => 
            (!selectedSize || sv.size.toLowerCase() === selectedSize.toLowerCase()) && 
            (!selectedWeight || sv.weight.toLowerCase() === selectedWeight.toLowerCase())
          ) || matchedColorVariant.subVariants[0];
        }

        if (!matchedVariant) return;

        const availableStock = matchedVariant.stock;
        const itemTier = item.priceTier || "B2C";
        const moq = resolveMoq(matchedVariant, itemTier);

        let targetQty = qty;

        // Enforce MOQ
        if (targetQty < moq) {
          useToastStore.getState().addToast(`MOQ required: minimum ${moq} units.`, "warning");
          targetQty = moq;
        }

        // Enforce stock
        if (targetQty > availableStock) {
          useToastStore.getState().addToast(`Limit exceeded. Only ${availableStock} units remaining in stock.`, "warning");
          targetQty = availableStock;
        }

        set((state) => ({
          items: state.items.map(i =>
            i.id === itemId ? { ...i, quantity: targetQty } : i
          )
        }));
      },

      clearCart: () => set({ items: [] }),

      getCartSubtotal: () => {
        return get().items.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0);
      },

      getCartItemsCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTaxDetails: () => {
        const isIntrastate = get().buyerState === "Madhya Pradesh";
        const hsnBreakdown: Record<string, TaxBreakdown> = {};
        
        let baseSubtotal = 0;
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;
        let grandTotal = 0;

        const storeProducts = useProductStore.getState().products;

        get().items.forEach((item) => {
          const p = storeProducts.find(prod => prod._id === (item.productId || item.product?._id)) || item.product;
          const rate = p?.gstRate ?? 18;
          const hsn = p?.hsnCode ?? "3924";
          const isIncl = p?.priceIncludesGst ?? true;
          
          const unitPrice = item.pricePerUnit;
          const qty = item.quantity;
          const totalAmount = unitPrice * qty;

          let basePrice = unitPrice;
          let itemTax = 0;
          let finalItemTotal = totalAmount;

          if (isIncl) {
            // Price includes GST
            basePrice = unitPrice / (1 + rate / 100);
            const itemBase = basePrice * qty;
            itemTax = totalAmount - itemBase;
            baseSubtotal += itemBase;
            grandTotal += totalAmount;
          } else {
            // Price excludes GST
            const itemBase = unitPrice * qty;
            itemTax = itemBase * (rate / 100);
            finalItemTotal = itemBase + itemTax;
            baseSubtotal += itemBase;
            grandTotal += finalItemTotal;
          }

          let cgst = 0;
          let sgst = 0;
          let igst = 0;

          if (isIntrastate) {
            cgst = itemTax / 2;
            sgst = itemTax / 2;
            totalCgst += cgst;
            totalSgst += sgst;
          } else {
            igst = itemTax;
            totalIgst += igst;
          }

          if (hsnBreakdown[hsn]) {
            hsnBreakdown[hsn].baseAmount += (basePrice * qty);
            hsnBreakdown[hsn].cgst += cgst;
            hsnBreakdown[hsn].sgst += sgst;
            hsnBreakdown[hsn].igst += igst;
            hsnBreakdown[hsn].totalTax += itemTax;
          } else {
            hsnBreakdown[hsn] = {
              hsnCode: hsn,
              gstRate: rate,
              baseAmount: (basePrice * qty),
              cgst,
              sgst,
              igst,
              totalTax: itemTax,
            };
          }
        });

        return {
          isIntrastate,
          baseSubtotal,
          totalCgst,
          totalSgst,
          totalIgst,
          grandTotal,
          hsnBreakdown,
        };
      },

      hydrateProducts: () => {
        const storeProducts = useProductStore.getState().products;
        if (storeProducts.length === 0) return;
        set((state) => ({
          items: state.items.map((item) => {
            const productId = item.productId || item.product?._id;
            const prod = storeProducts.find((p) => p._id === productId);
            return { ...item, productId, product: prod || item.product };
          })
        }));
      }
    }),
    {
      name: "flexsell-cart-storage",
      // Exclude full product from serialization to keep localStorage size minimal
      partialize: (state) => ({
        ...state,
        items: state.items.map((item) => ({
          id: item.id,
          productId: item.productId || item.product._id,
          selectedVariants: item.selectedVariants,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          priceTier: item.priceTier || "B2C",
        }))
      }) as any,
      // Hydrate product objects from the productStore upon rehydration
      onRehydrateStorage: () => () => {
        // Product hydration is handled lazily by CartView/CheckoutView
        // after the product store is initialized
      }
    }
  )
);
