import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product, CartItem } from "@/types";
import { useProductStore } from "./productStore";
import { useToastStore } from "./toastStore";
import { useAuthStore } from "./authStore";
import { resolveVariantKeys } from "@/lib/variantMatcher";
import { resolvePrice, resolveMoq, resolvePriceTierName, isPureB2B } from "@/lib/priceTierHelper";
import { dispatchEvent } from "@/lib/events/eventDispatcher";

/**
 * Canonical, order-independent identity for a chosen set of variant options.
 *
 * Matching cart lines by `item.id.includes(variantKey)` was a substring test, so a key like
 * `Size:M` matched a line for `Size:ML` and the two variants collapsed into one — adding one
 * silently overwrote the other's quantity and price. Compare these keys with `===` instead.
 */
function buildVariantKey(selectedVariants: Record<string, string>): string {
  return Object.entries(selectedVariants || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

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
  delegatedCustomerId?: string;
  setDelegatedCustomerId: (id: string) => void;
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
      delegatedCustomerId: "",

      setDelegatedCustomerId: (id) => set({ delegatedCustomerId: id }),
      setBuyerState: (state) => set({ buyerState: state }),

      addItem: (product, selectedVariants, quantity = 1, priceTierInput = "B2C") => {
        const customer = useAuthStore.getState().customer;
        const customerTypes = customer?.customerTypes || ["B2C"];

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

        const variantKey = buildVariantKey(selectedVariants);

        const availableStock = matchedVariant.stock;
        const moq = resolveMoq(matchedVariant, customer || customerTypes);

        // Check if item exists in cart
        const existingItem = get().items.find(item => item.productId === liveProduct._id && buildVariantKey(item.selectedVariants) === variantKey);
        const currentQty = existingItem ? existingItem.quantity : 0;
        let targetQty = currentQty + quantity;

        // Verify mandatory MOQ constraint (Pure B2B only)
        if (targetQty < moq) {
          useToastStore.getState().addToast(`MOQ required for B2B orders. Minimum limit is ${moq} units.`, "warning");
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

        const calculatedPrice = resolvePrice(matchedVariant, customer || customerTypes, targetQty);
        const resolvedTierName = resolvePriceTierName(matchedVariant, customer || customerTypes, targetQty);
        const itemId = `${product._id}-${variantKey}-${resolvedTierName}`;

        set((state) => {
          const existingIndex = state.items.findIndex(item => item.productId === liveProduct._id && buildVariantKey(item.selectedVariants) === variantKey);
          const updatedItems = [...state.items];

          if (existingIndex > -1) {
            const oldPrice = updatedItems[existingIndex].pricePerUnit;
            updatedItems[existingIndex].id = itemId;
            updatedItems[existingIndex].quantity = targetQty;
            updatedItems[existingIndex].pricePerUnit = calculatedPrice;
            updatedItems[existingIndex].priceTier = resolvedTierName;
            
            if (calculatedPrice < oldPrice) {
              useToastStore.getState().addToast(`🎉 Bulk discount unlocked! Order quantity ${targetQty} reached MOQ threshold. Unit price upgraded to ${resolvedTierName} rate!`, "success");
            } else {
              useToastStore.getState().addToast(`Updated quantity in cart to ${targetQty}.`, "success");
            }
            return { items: updatedItems };
          } else {
            if (resolvedTierName === "B2B" && customerTypes.includes("B2C")) {
              useToastStore.getState().addToast(`🎉 Added ${targetQty} items at B2B wholesale price (${calculatedPrice})!`, "success");
            } else {
              useToastStore.getState().addToast(`Successfully added ${targetQty} items to cart!`, "success");
            }
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
                  priceTier: resolvedTierName,
                }
              ]
            };
          }
        });

        // Trigger Rule 4 Event: Customer Notification = TRUE, Mail = FALSE, Admin = FALSE
        try {
          dispatchEvent({
            eventType: "CART_ITEM_ADDED",
            category: "orders",
            actor: { id: customer?._id || "guest", name: customer?.name || "Customer", role: "customer" },
            recipient: { customerId: customer?._id || "active-user", role: "customer" },
            entity: { type: "product", id: liveProduct._id },
            data: { productTitle: liveProduct.title || liveProduct.title, quantity: targetQty }
          });
        } catch {
          // non-blocking
        }
      },

      removeItem: (itemId) => {
        const itemToRemove = get().items.find(item => item.id === itemId);
        set((state) => ({
          items: state.items.filter(item => item.id !== itemId)
        }));
        useToastStore.getState().addToast("Item removed from wholesale cart.", "info");

        // Trigger Rule 4 Event: Customer Notification = TRUE, Mail = FALSE, Admin = FALSE
        try {
          const customer = useAuthStore.getState().customer;
          dispatchEvent({
            eventType: "CART_ITEM_REMOVED",
            category: "orders",
            actor: { id: customer?._id || "guest", name: customer?.name || "Customer", role: "customer" },
            recipient: { customerId: customer?._id || "active-user", role: "customer" },
            entity: { type: "product", id: itemToRemove?.productId || itemId },
            data: { productTitle: itemToRemove?.product?.title || "Item" }
          });
        } catch {
          // non-blocking
        }
      },

      updateQuantity: (itemId, qty) => {
        const item = get().items.find(i => i.id === itemId);
        if (!item) return;

        const customer = useAuthStore.getState().customer;
        const customerTypes = customer?.customerTypes || ["B2C"];

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
        const moq = resolveMoq(matchedVariant, customer || customerTypes);

        let targetQty = qty;

        const isPureB2bCustomer = isPureB2B(customerTypes);

        // Enforce mandatory MOQ constraint (Pure B2B accounts only)
        if (isPureB2bCustomer && targetQty < moq) {
          useToastStore.getState().addToast(`MOQ required for Pure B2B orders: minimum ${moq} units.`, "warning");
          targetQty = moq;
        }

        // Enforce stock
        if (targetQty > availableStock) {
          useToastStore.getState().addToast(`Limit exceeded. Only ${availableStock} units remaining in stock.`, "warning");
          targetQty = availableStock;
        }

        const newPricePerUnit = resolvePrice(matchedVariant, customer || customerTypes, targetQty);
        const newPriceTier = resolvePriceTierName(matchedVariant, customer || customerTypes, targetQty);

        if (item.pricePerUnit > newPricePerUnit) {
          useToastStore.getState().addToast(`🎉 Wholesale price unlocked! Unit price upgraded to B2B rate.`, "success");
        }

        set((state) => ({
          items: state.items.map(i =>
            i.id === itemId ? {
              ...i,
              id: `${i.productId}-${Object.entries(i.selectedVariants).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`${k}:${v}`).join("|")}-${newPriceTier}`,
              quantity: targetQty,
              pricePerUnit: newPricePerUnit,
              priceTier: newPriceTier
            } : i
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
        const sellerState = process.env.NEXT_PUBLIC_SELLER_STATE || "Madhya Pradesh";
        const isIntrastate = get().buyerState.toLowerCase() === sellerState.toLowerCase();
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
        const customer = useAuthStore.getState().customer;
        const customerTypes = customer?.customerTypes || ["B2C"];

        if (storeProducts.length === 0) return;
        set((state) => ({
          items: state.items.map((item) => {
            const productId = item.productId || item.product?._id;
            const prod = storeProducts.find((p) => p._id === productId);
            if (!prod) return item;

            // Recalculate pricePerUnit & MOQ for fresh pricing based on active customerTypes
            const { color: selectedColor, size: selectedSize, weight: selectedWeight } = resolveVariantKeys(item.selectedVariants);
            const cv = prod.colorVariants?.find(c => c.color.toLowerCase() === selectedColor.toLowerCase()) || prod.colorVariants?.[0];
            const sv = cv?.subVariants?.find(s => 
              (!selectedSize || s.size.toLowerCase() === selectedSize.toLowerCase()) && 
              (!selectedWeight || s.weight.toLowerCase() === selectedWeight.toLowerCase())
            ) || cv?.subVariants?.[0];

            const moq = resolveMoq(sv, customer || customerTypes);
            let targetQty = item.quantity;
            if (targetQty < moq) {
              targetQty = moq;
            }

            const updatedPrice = sv ? resolvePrice(sv, customer || customerTypes, targetQty) : item.pricePerUnit;
            const updatedTierName = sv ? resolvePriceTierName(sv, customer || customerTypes, targetQty) : (item.priceTier || "B2C");
            const variantKey = buildVariantKey(item.selectedVariants);

            return {
              ...item,
              id: `${productId}-${variantKey}-${updatedTierName}`,
              productId,
              product: prod,
              quantity: targetQty,
              pricePerUnit: updatedPrice > 0 ? updatedPrice : item.pricePerUnit,
              priceTier: updatedTierName,
            };
          })
        }));
      }
    }),
    {
      name: "flexsell-cart-storage",
      partialize: (state) => ({
        ...state,
        items: state.items.map((item) => ({
          id: item.id,
          productId: item.productId || item.product?._id,
          product: item.product ? {
            _id: item.product._id,
            title: item.product.title,
            gstRate: item.product.gstRate,
            hsnCode: item.product.hsnCode,
            priceIncludesGst: item.product.priceIncludesGst,
            colorVariants: item.product.colorVariants,
          } : undefined,
          selectedVariants: item.selectedVariants,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          priceTier: item.priceTier || "B2C",
        })),
        delegatedCustomerId: state.delegatedCustomerId,
      }) as any,
      onRehydrateStorage: () => () => {
        // Hydrate after rehydration
      }
    }
  )
);
