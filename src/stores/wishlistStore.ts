import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "@/types";
import { customerService } from "@/services/customerService";
import { productService } from "@/services/productService";

interface WishlistState {
  items: Product[];
  toggleWishlist: (product: Product) => Promise<void>;
  isInWishlist: (productId: string) => boolean;
  syncWithDb: () => Promise<void>;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      
      toggleWishlist: async (product) => {
        const exists = get().items.some(item => item._id === product._id);
        let nextItems: Product[] = [];
        
        if (exists) {
          nextItems = get().items.filter(item => item._id !== product._id);
        } else {
          nextItems = [...get().items, product];
        }
        
        set({ items: nextItems });

        try {
          const activeCustomer = await customerService.getActiveCustomer();
          if (activeCustomer) {
            const wishlistIds = nextItems.map(item => item._id);
            await customerService.updateActiveCustomer({ wishlist: wishlistIds });
          }
        } catch (_err) {
          // Silent catch if guest or not authenticated
          console.log("Wishlist DB sync skipped: User not authenticated.");
        }
      },

      isInWishlist: (productId) => {
        return get().items.some(item => item._id === productId);
      },

      syncWithDb: async () => {
        try {
          const activeCustomer = await customerService.getActiveCustomer();
          if (activeCustomer && activeCustomer.wishlist) {
            const allProducts = await productService.getProducts();
            const matchedProducts = allProducts.filter(p => 
              activeCustomer.wishlist?.includes(p._id)
            );
            set({ items: matchedProducts });
          }
        } catch (_err) {
          console.log("Wishlist DB initial load skipped: User not authenticated.");
        }
      }
    }),
    {
      name: "flexsell-wishlist-storage",
    }
  )
);
