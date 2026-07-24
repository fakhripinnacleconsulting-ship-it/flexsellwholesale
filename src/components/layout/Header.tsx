"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Heart, User, Menu } from "lucide-react";
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
import { NotificationPopover } from "./NotificationPopover";

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
      <div className="mx-auto flex h-14 sm:h-16 max-w-8xl items-center justify-between px-3 sm:px-4 md:px-6">
        {/* Mobile Menu Icon */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-foreground cursor-pointer h-9 w-9 p-0 flex items-center justify-center shrink-0" 
          aria-label="Open Menu" 
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-1.5 shrink-0 my-auto" aria-label="Flexsell Wholesale Home">
          <Image 
            src="/Flexsell%20Logo.png" 
            alt="Flexsell Logo" 
            width={140} 
            height={38} 
            style={{ width: "auto", height: "auto" }} 
            className="h-6 sm:h-7 md:h-8 max-w-[100px] sm:max-w-[125px] md:max-w-[150px] w-auto object-contain shrink-0" 
            priority 
          />
        </Link>

        {/* Global Search Bar - Desktop Only */}
        <div className="hidden md:flex flex-1 max-w-md mx-6 lg:mx-8">
          <GlobalSearchInput placeholder="Search trending products, SKUs, categories..." />
        </div>

        {/* User Greeting & Utility Icons */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
          {/* Greeting text if logged in */}
          {isMounted && customer && (
            <span className="hidden lg:inline-block text-xs font-bold text-muted-foreground">
              Hi, <span className="text-primary">{customer.name.split(" ")[0]}</span>
            </span>
          )}

          {isMounted && customer && (
            <NotificationPopover
              role={customer.role === "admin" ? "admin" : "customer"}
              customerId={customer._id}
            />
          )}

          <Link href={customer ? (customer.role === "admin" ? "/admin" : "/client/profile") : "/login"} aria-label={customer ? "My Account" : "Sign In"}>
            <Button variant="ghost" size="icon" className="cursor-pointer h-9 w-9 p-0 flex items-center justify-center" title={customer ? "My Account" : "Sign In"} aria-label={customer ? "My Account" : "Sign In"}>
              <User className="h-4.5 w-4.5 text-foreground" />
            </Button>
          </Link>

          <Link href="/wishlist" aria-label="Wishlist">
            <Button variant="ghost" size="icon" className="relative cursor-pointer h-9 w-9 p-0 flex items-center justify-center" title="Wishlist" aria-label="Wishlist">
              <Heart className="h-4.5 w-4.5 text-foreground" />
              {isMounted && wishlistItemsCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  key={wishlistItemsCount}
                  className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold shadow-sm"
                >
                  {wishlistItemsCount}
                </motion.span>
              )}
            </Button>
          </Link>

          {!isDropshipperOnly && (
            <Link href="/cart" aria-label="Shopping Cart">
              <Button variant="ghost" size="icon" className="relative cursor-pointer h-9 w-9 p-0 flex items-center justify-center" title="Cart" aria-label="Shopping Cart">
                <ShoppingCart className="h-4.5 w-4.5 text-foreground" />
                {isMounted && cartItemsCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={cartItemsCount}
                    className="absolute top-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground font-bold shadow-sm"
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
        <div className="flex flex-col h-full space-y-5 pt-1 select-none text-foreground">
          {/* Drawer Header Brand Logo */}
          <div className="flex items-center border-b pb-3 pr-8">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
              <Image 
                src="/Flexsell%20Logo.png" 
                alt="Flexsell Logo" 
                width={120} 
                height={32} 
                style={{ width: "auto", height: "auto" }}
                className="h-6 w-auto object-contain" 
              />
            </Link>
          </div>

          <div className="relative">
            <GlobalSearchInput
              isMobile
              placeholder="Search SKUs or products..."
              onSearchSubmitted={() => setIsMobileMenuOpen(false)}
            />
          </div>

          <nav className="flex flex-col space-y-2.5 overflow-y-auto pr-1">
            <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Collections</div>
            {collections.filter(c => c.isActive).map(col => {
              const formattedTitle = col.title
                .toLowerCase()
                .split(" ")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
              return (
                <Link key={col._id} href={`/collections/${col.slug}`} className="text-xs font-semibold hover:text-primary pl-2 text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                  {formattedTitle}
                </Link>
              );
            })}

            <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider mt-2 mb-0.5">Categories</div>
            {topLevel.map(cat => (
              <Link key={cat._id} href={`/categories/${cat.slug}`} className="text-xs font-medium hover:text-primary pl-2 text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                {cat.name}
              </Link>
            ))}

            <div className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider mt-3 mb-0.5">Quick Links</div>
            <Link href="/products" className="text-xs font-medium hover:text-primary pl-2 text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>All Products</Link>
            <Link href="/dropshipping" className="text-xs font-semibold text-primary hover:underline pl-2" onClick={() => setIsMobileMenuOpen(false)}>Dropshipping Program</Link>
            <Link href="/about" className="text-xs font-medium hover:text-primary pl-2 text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>About Us</Link>
            <Link href="/contact" className="text-xs font-medium hover:text-primary pl-2 text-foreground transition-colors" onClick={() => setIsMobileMenuOpen(false)}>Contact Support</Link>
          </nav>

          <div className="mt-auto pt-4 border-t">
            <Link href={customer ? "/client/profile" : "/login"} onClick={() => setIsMobileMenuOpen(false)}>
              <Button className="w-full font-bold text-xs h-9" variant="outline">{customer ? "My Account Dashboard" : "Sign In / Register"}</Button>
            </Link>
          </div>
        </div>
      </Drawer>
    </header>
  );
}
