"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Heart, User, Menu, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Drawer } from "@/components/ui/Drawer";
import { MegaMenu } from "./MegaMenu";
import { Category, Collection } from "@/types";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";
import { useAuthStore } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";

import { GlobalSearchInput } from "@/components/storefront/GlobalSearchInput";

interface HeaderProps {
  categories: Category[];
  collections?: Collection[];
}

export function Header({ categories, collections = [] }: HeaderProps) {
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const cartItemsCount = useCartStore((state) => state.getCartItemsCount());
  const wishlistItemsCount = useWishlistStore((state) => state.items.length);
  const customer = useAuthStore((state) => state.customer);
  const isDropshipperOnly = customer && customer.customerTypes && customer.customerTypes.length === 1 && customer.customerTypes[0] === "Dropshipping";

  const topLevel = categories.filter(c => !c.parentId);

  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 transition-all">
      <div className="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 md:px-6">
        {/* Mobile Menu Icon */}
        <Button variant="ghost" size="icon" className="md:hidden text-foreground cursor-pointer" onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>

        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={160} height={44} className="h-10 md:h-12 w-auto object-contain" priority />
        </Link>

        {/* Global Search Bar - Desktop Only */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <GlobalSearchInput placeholder="Search trending products, SKUs, categories..." />
        </div>

        {/* User Greeting & Utility Icons */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Greeting text if logged in */}
          {isMounted && customer && (
            <span className="hidden lg:inline-block text-sm font-bold text-muted-foreground">
              Hi, <span className="text-primary">{customer.name.split(" ")[0]}</span>
            </span>
          )}

          <Link href={customer ? (customer.role === "admin" ? "/admin" : "/client/profile") : "/login"}>
            <Button variant="ghost" size="icon" className="cursor-pointer" title={customer ? "My Account" : "Sign In"}>
              <User className="h-5 w-5 text-foreground" />
            </Button>
          </Link>

          <Link href="/wishlist">
            <Button variant="ghost" size="icon" className="relative cursor-pointer" title="Wishlist">
              <Heart className="h-5 w-5 text-foreground" />
              {isMounted && wishlistItemsCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={wishlistItemsCount}
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold shadow-sm"
                >
                  {wishlistItemsCount}
                </motion.span>
              )}
            </Button>
          </Link>

          {!isDropshipperOnly && (
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative cursor-pointer" title="Cart">
                <ShoppingCart className="h-5 w-5 text-foreground" />
                {isMounted && cartItemsCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={cartItemsCount}
                    className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold shadow-sm"
                  >
                    {cartItemsCount}
                  </motion.span>
                )}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Category Nav - Desktop Only */}
      <MegaMenu categories={categories} collections={collections} />

      {/* Mobile Nav Drawer */}
      <Drawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} side="left">
        <div className="flex flex-col h-full space-y-6 pt-4 select-none">
          <div className="flex justify-between items-center border-b pb-3">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
              <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={110} height={28} className="h-7 w-auto object-contain" />
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative">
            <GlobalSearchInput
              isMobile
              placeholder="Search SKUs or products..."
              onSearchSubmitted={() => setIsMobileMenuOpen(false)}
            />
          </div>

          <nav className="flex flex-col space-y-3 overflow-y-auto">
            <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider mb-1">Collections</div>
            {collections.filter(c => c.isActive).map(col => {
              const formattedTitle = col.title
                .toLowerCase()
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
              return (
                <Link key={col._id} href={`/collections/${col.slug}`} className="text-sm font-semibold hover:text-primary pl-2 text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                  {formattedTitle}
                </Link>
              );
            })}

            <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider mt-3 mb-1">Categories</div>
            {topLevel.map(cat => (
              <Link key={cat._id} href={`/categories/${cat.slug}`} className="text-xs font-medium hover:text-primary pl-2 text-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                {cat.name}
              </Link>
            ))}

            <div className="font-bold text-xs text-muted-foreground uppercase tracking-wider mt-4 mb-1">Quick Links</div>
            <Link href="/products" className="text-sm font-medium hover:text-primary pl-2 text-foreground" onClick={() => setIsMobileMenuOpen(false)}>All Products</Link>
            <Link href="/dropshipping" className="text-sm font-medium hover:text-primary pl-2 text-primary font-bold" onClick={() => setIsMobileMenuOpen(false)}>Dropshipping Program</Link>
            <Link href="/about" className="text-sm font-medium hover:text-primary pl-2 text-foreground" onClick={() => setIsMobileMenuOpen(false)}>About Us</Link>
            <Link href="/contact" className="text-sm font-medium hover:text-primary pl-2 text-foreground" onClick={() => setIsMobileMenuOpen(false)}>Contact Support</Link>
          </nav>

          <div className="mt-auto pt-4 border-t">
            <Link href={customer ? "/client/profile" : "/login"} onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full font-bold" variant="outline">{customer ? "My Account Dashboard" : "Sign In / Register"}</Button>
            </Link>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
