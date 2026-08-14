"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Search, ShoppingCart, User } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  const cartItemsCount = useCartStore((state) => state.getCartItemsCount());
  const customer = useAuthStore((state) => state.customer);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Don't display in admin dashboard routes (only for customer storefront navigation)
  if (pathname.startsWith("/admin")) return null;

  const accountHref = customer
    ? customer.role === "admin"
      ? "/admin"
      : "/client/profile"
    : "/login";

  const navItems = [
    {
      id: "shop",
      label: "Shop",
      href: "/products",
      icon: LayoutGrid,
      exact: false,
    },
    {
      id: "search",
      label: "Search",
      href: "/search",
      icon: Search,
      exact: false,
    },
    {
      id: "home",
      label: "Home",
      href: "/",
      icon: Home,
      exact: true,
      isCenter: true,
    },
    {
      id: "cart",
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      exact: false,
      badge: cartItemsCount,
    },
    {
      id: "account",
      label: "Account",
      href: accountHref,
      icon: User,
      exact: false,
    },
  ];

  return (
    <div className="md:hidden fixed bottom-4 left-0 right-0 z-50 select-none no-print print:hidden flex justify-center px-4">
      <nav className="relative flex items-center justify-around overflow-hidden shadow-[0_6px_6px_rgba(0,0,0,0.2),0_0_20px_rgba(0,0,0,0.1)] transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,2.2)] rounded-[2rem] p-[0.6rem] w-full max-w-[340px] mx-auto group hover:p-[0.8rem] hover:rounded-[2.5rem]">
        
        {/* liquidGlass-effect */}
        <div className="absolute z-0 inset-0 backdrop-blur-[3px] overflow-hidden rounded-[2rem] group-hover:rounded-[2.5rem] transition-all duration-[400ms]" style={{ filter: 'url(#glass-distortion)' }}></div>
        
        {/* liquidGlass-tint */}
        <div className="absolute z-[1] inset-0 bg-white/50 dark:bg-black/40 rounded-[2rem] group-hover:rounded-[2.5rem] transition-all duration-[400ms]"></div>
        
        {/* liquidGlass-shine */}
        <div className="absolute z-[2] inset-0 overflow-hidden shadow-[inset_2px_2px_1px_0_rgba(255,255,255,0.5),inset_-1px_-1px_1px_1px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_1px_0_rgba(255,255,255,0.1),inset_-1px_-1px_1px_1px_rgba(255,255,255,0.1)] rounded-[2rem] group-hover:rounded-[2.5rem] transition-all duration-[400ms]"></div>

        {/* SVG filter definition for #glass-distortion */}
        <svg width="0" height="0" className="absolute pointer-events-none">
          <filter id="glass-distortion">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>

        <div className="relative z-[3] flex items-center justify-around w-full gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === "account"
              ? pathname.startsWith("/client") || pathname.startsWith("/admin") || pathname === "/login"
              : item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);

            if (item.isCenter) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  className="flex flex-col items-center justify-center cursor-pointer relative z-10 px-1"
                >
                  <div
                    className={`p-2 rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,2.2)] flex items-center justify-center ${
                      isActive
                        ? "bg-primary text-primary-foreground scale-[1.15] shadow-[0_4px_15px_rgba(0,0,0,0.2)] shadow-primary/40"
                        : "bg-primary/90 text-primary-foreground hover:scale-110 shadow-sm"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`text-[9px] tracking-tight mt-1 font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                prefetch={true}
                className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all duration-[400ms] cursor-pointer relative min-w-[48px] group/item ${
                  isActive
                    ? "text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div
                  className={`p-1.5 rounded-2xl transition-all duration-[400ms] ease-[cubic-bezier(0.175,0.885,0.32,2.2)] relative flex items-center justify-center ${
                    isActive
                      ? "bg-primary/10 text-primary scale-110"
                      : "group-hover/item:bg-secondary/40 group-hover/item:scale-105"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" />

                  {/* Live Count Badge */}
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-extrabold text-[9px] h-3.5 min-w-3.5 px-1 rounded-full flex items-center justify-center shadow-sm">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[9px] tracking-tight mt-0.5 transition-all duration-[400ms] ${
                    isActive ? "font-bold text-primary" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
