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
    <div className="md:hidden fixed bottom-3 left-3 right-3 z-50 select-none">
      <nav className="bg-card/95 backdrop-blur-md border border-border/80 rounded-2xl p-1.5 shadow-2xl flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          if (item.isCenter) {
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex flex-col items-center justify-center -mt-6 cursor-pointer relative z-10"
              >
                <div
                  className={`p-3.5 rounded-full transition-all shadow-xl flex items-center justify-center ring-4 ring-card ${
                    isActive
                      ? "bg-primary text-primary-foreground scale-110 shadow-primary/30"
                      : "bg-primary text-primary-foreground hover:scale-105"
                  }`}
                >
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <span className="text-[10px] tracking-tight mt-1 font-extrabold text-primary">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl transition-all cursor-pointer relative min-w-[54px] ${
                isActive
                  ? "text-primary font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all relative flex items-center justify-center ${
                  isActive
                    ? "bg-primary/10 text-primary scale-105"
                    : "hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-5 w-5" />

                {/* Live Count Badge */}
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white font-extrabold text-[10px] h-4 min-w-4 px-1 rounded-full flex items-center justify-center shadow-xs">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] tracking-tight mt-0.5 ${
                  isActive ? "font-bold text-primary" : "font-medium"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
