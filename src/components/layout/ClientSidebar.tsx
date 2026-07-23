"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Heart, MapPin, User, Star, Ticket, Bell, LogOut, Menu, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { Customer } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { useDashboardViewStore } from "@/stores/dashboardViewStore";

const sidebarLinks = [
  { name: "Dashboard", href: "/client", icon: User },
  { name: "My Orders", href: "/client/orders", icon: Package },
  { name: "Wishlist", href: "/client/wishlist", icon: Heart },
  { name: "Addresses", href: "/client/addresses", icon: MapPin },
  { name: "Profile", href: "/client/profile", icon: User },
  { name: "My Reviews", href: "/client/reviews", icon: Star },
  { name: "Coupons", href: "/client/coupons", icon: Ticket },
  { name: "Notifications", href: "/client/notifications", icon: Bell },
];

interface ClientSidebarProps {
  activeCustomer: Customer;
}

export function ClientSidebar({ activeCustomer }: ClientSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);
  const { activeView, setActiveView } = useDashboardViewStore();

  const customerTypes = activeCustomer.customerTypes || ["B2C"];

  React.useEffect(() => {
    if (customerTypes.length === 1 && activeView !== customerTypes[0]) {
      setActiveView(customerTypes[0]);
    }
  }, [customerTypes, activeView, setActiveView]);

  const filteredLinks = React.useMemo(() => {
    const baseLinks = [
      { name: "Dashboard", href: "/client", icon: User },
      { 
        name: activeView === "B2C" ? "My Orders" : activeView === "B2B" ? "Bulk Orders" : "Fulfilled Orders", 
        href: "/client/orders", 
        icon: Package 
      },
      { name: "Wishlist", href: "/client/wishlist", icon: Heart },
      { name: "Addresses", href: "/client/addresses", icon: MapPin },
      { name: "Profile", href: "/client/profile", icon: User },
    ];

    if (activeView !== "Dropshipping") {
      baseLinks.push(
        { name: "My Reviews", href: "/client/reviews", icon: Star },
        { name: "Coupons", href: "/client/coupons", icon: Ticket }
      );
    }

    baseLinks.push(
      { name: "Notifications", href: "/client/notifications", icon: Bell }
    );

    return baseLinks;
  }, [activeView]);

  React.useEffect(() => {
    const saved = localStorage.getItem("client_sidebar_open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem("client_sidebar_open", String(nextState));
  };

  // Auto-close mobile drawer when pathname changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const SidebarContent = ({ isCollapsed }: { isCollapsed?: boolean }) => (
    <div className="bg-card flex flex-col h-full select-none">
      <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between min-h-[85px] gap-2">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 overflow-hidden">
            <Avatar initials={activeCustomer.initials} className="bg-primary-foreground text-primary border border-primary-foreground/20 flex-shrink-0" />
            <div className="truncate">
              <h2 className="text-sm font-bold truncate">My Account</h2>
              <p className="text-xs opacity-90 truncate">{activeCustomer.name}</p>
            </div>
          </div>
        ) : (
          <Avatar initials={activeCustomer.initials} className="mx-auto bg-primary-foreground text-primary border border-primary-foreground/20 flex-shrink-0" />
        )}
      </div>

      {/* View Switcher Dropdown (Multi-type customers only) */}
      {!isCollapsed && customerTypes.length > 1 && (
        <div className="px-4 py-3 border-b border-border/60 bg-secondary/10">
          <label className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground block mb-1">
            Dashboard View
          </label>
          <select
            value={activeView}
            onChange={(e) => setActiveView(e.target.value as any)}
            className="w-full text-xs font-bold bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary text-foreground cursor-pointer"
          >
            {customerTypes.map(type => (
              <option key={type} value={type}>
                {type === "B2C" ? "🟢 B2C — Retail" : 
                 type === "B2B" ? "🔵 B2B — Wholesale" : 
                 "🟣 Dropshipping"}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex flex-col p-2 space-y-0.5">
        {filteredLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md transition-colors relative group ${
                isActive 
                  ? "bg-primary/10 text-primary font-bold" 
                  : "hover:bg-secondary hover:text-primary text-foreground"
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!isCollapsed && <span className="transition-opacity duration-300 opacity-100">{link.name}</span>}
              
              {/* Tooltip when collapsed */}
              {isCollapsed && (
                <span className="absolute left-14 bg-popover text-popover-foreground border px-2 py-1 rounded shadow-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  {link.name}
                </span>
              )}
            </Link>
          );
        })}
        <div className="my-2 border-t"></div>
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-md hover:bg-destructive/10 text-destructive transition-colors w-full text-left cursor-pointer relative group"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Logout</span>}
          
          {/* Tooltip when collapsed */}
          {isCollapsed && (
            <span className="absolute left-14 bg-popover text-destructive border border-destructive/20 px-2 py-1 rounded shadow-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
              Logout
            </span>
          )}
        </button>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile sub-topbar */}
      <div className="md:hidden flex justify-between items-center bg-card border p-3 rounded-lg mb-4 w-full">
        <span className="font-bold text-sm text-foreground">Dashboard Menu</span>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-semibold hover:bg-primary/20 cursor-pointer"
        >
          <Menu className="h-4 w-4" /> Open Menu
        </button>
      </div>

      {/* Desktop Sidebar (Collapsible) */}
      <aside className={`flex-shrink-0 hidden md:block transition-all duration-300 ${
        isSidebarOpen ? "w-64" : "w-16"
      }`}>
        <div className="bg-card border rounded-lg overflow-hidden sticky top-24 relative">
          {/* Sidebar Toggle Button floating at the top-right corner of the sidebar */}
          <button
            onClick={handleToggleSidebar}
            className={`absolute top-2 bg-secondary/80 hover:bg-secondary text-foreground rounded-full border p-1 shadow-sm transition-transform duration-200 z-10 cursor-pointer ${
              isSidebarOpen ? "right-2" : "left-1/2 -translate-x-1/2"
            }`}
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? (
              <ChevronLeft className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          
          <SidebarContent isCollapsed={!isSidebarOpen} />
        </div>
      </aside>

      {/* Mobile Drawer (visible only when toggled) */}
      <Drawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} side="left" className="p-0 max-w-[280px] w-full">
        <SidebarContent isCollapsed={false} />
      </Drawer>
    </>
  );
}
