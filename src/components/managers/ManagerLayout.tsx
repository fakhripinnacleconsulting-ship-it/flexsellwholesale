"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, FolderTree, Users,
  Settings, Tags, CreditCard, Menu, Percent, FileText, LogOut,
  ChevronLeft, ChevronRight, MessageSquare, MessageSquarePlus, Truck, Layers,
  Bell, Check
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";

import { ManagerAutoLogoutGuard } from "./ManagerAutoLogoutGuard";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { manager, logout, checkSession, isLoading } = useAuthStore();

  const [initialCheckDone, setInitialCheckDone] = React.useState(false);

  React.useEffect(() => {
    checkSession().finally(() => {
      setInitialCheckDone(true);
    });
  }, [checkSession]);

  React.useEffect(() => {
    if (initialCheckDone && !isLoading && !manager) {
      router.push("/manager/login");
    }
  }, [initialCheckDone, isLoading, manager, router]);

  React.useEffect(() => {
    const saved = localStorage.getItem("manager_sidebar_open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  if (!initialCheckDone || isLoading || !manager) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading portal...</div>;
  }

  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem("manager_sidebar_open", String(nextState));
  };

  const perms = manager.permissions || [];
  const hasPerm = (p: string) => perms.includes(p) || perms.includes(`${p}:read`) || perms.includes(`${p}:update`) || perms.includes(`${p}:create`) || perms.includes(`${p}:delete`);

  const sidebarLinks = [

    // Catalog
    { name: "Products", href: "/manager/catalog/products", icon: ShoppingBag, show: hasPerm("catalog_products") },
    { name: "Categories", href: "/manager/catalog/categories", icon: FolderTree, show: hasPerm("catalog_categories") },
    { name: "Collections", href: "/manager/catalog/collections", icon: Layers, show: hasPerm("catalog_collections") },

    // Orders
    { name: "B2C Orders", href: "/manager/orders/b2c", icon: CreditCard, show: hasPerm("orders_b2c") },
    { name: "B2B Orders", href: "/manager/orders/b2b", icon: CreditCard, show: hasPerm("orders_b2b") },
    { name: "Dropshipping Orders", href: "/manager/orders/dropshipping", icon: CreditCard, show: hasPerm("orders_dropshipping") },

    // Customers
    { name: "B2C Customers", href: "/manager/customers/b2c", icon: Users, show: hasPerm("customers_b2c") },
    { name: "B2B Customers", href: "/manager/customers/b2b", icon: Users, show: hasPerm("customers_b2b") },
    { name: "Dropship Customers", href: "/manager/customers/dropshipping", icon: Users, show: hasPerm("customers_dropshipping") },

    // Documents
    { name: "Invoices", href: "/manager/documents/invoices", icon: FileText, show: hasPerm("invoices_invoice") },
    { name: "Quotes", href: "/manager/documents/quotes", icon: FileText, show: hasPerm("invoices_quote") },
    { name: "Receipts", href: "/manager/documents/receipts", icon: FileText, show: hasPerm("invoices_receipt") },

    // Inquiries
    { name: "Wholesale Inquiries", href: "/manager/inquiries/wholesale", icon: MessageSquarePlus, show: hasPerm("inquiries_wholesale") },
    { name: "Dropship Inquiries", href: "/manager/inquiries/dropshipping", icon: MessageSquarePlus, show: hasPerm("inquiries_dropshipping") },
    { name: "Support Tickets", href: "/manager/inquiries/support", icon: MessageSquarePlus, show: hasPerm("inquiries_support") },
    { name: "Franchise Leads", href: "/manager/inquiries/franchise", icon: MessageSquarePlus, show: hasPerm("inquiries_franchise") },
    { name: "General Contacts", href: "/manager/inquiries/general", icon: MessageSquarePlus, show: hasPerm("inquiries_general") },

    // Ops
    { name: "HSN Management", href: "/manager/ops/hsn", icon: Percent, show: hasPerm("ops_hsn") },
    { name: "Shipping Charges", href: "/manager/ops/shipping", icon: Truck, show: hasPerm("ops_shipping") },
    { name: "Coupons", href: "/manager/ops/coupons", icon: Tags, show: hasPerm("ops_coupons") },

    // Content
    { name: "Product Reviews", href: "/manager/content/reviews", icon: MessageSquare, show: hasPerm("content_reviews") },
    { name: "Website CMS", href: "/manager/content/cms", icon: FileText, show: hasPerm("content_cms") },
  ].filter(link => link.show);

  const SidebarContent = ({ isCollapsed }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full select-none">
      <div className="p-4 border-b flex items-center justify-between min-h-[73px] bg-secondary/20">
        {!isCollapsed ? (
          <Link href="/manager" className="flex flex-col gap-1 items-start overflow-hidden">
            <span className="font-bold text-lg text-primary tracking-tight">Staff Portal</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{manager.name}</span>
          </Link>
        ) : (
          <Link href="/manager" className="mx-auto font-black text-xl text-primary font-sans h-8 flex items-center justify-center">
            SP
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col justify-between custom-scrollbar">
        <nav className="space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/manager');
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors relative group ${isActive
                    ? "bg-primary text-primary-foreground font-bold shadow-md"
                    : "hover:bg-secondary hover:text-primary text-foreground"
                  }`}
              >
                <Icon className="h-4.5 w-4.5 flex-shrink-0" />
                {!isCollapsed && <span className="transition-opacity duration-300 opacity-100 truncate">{link.name}</span>}

                {/* Tooltip on hover when collapsed */}
                {isCollapsed && (
                  <span className="absolute left-14 bg-popover text-popover-foreground border px-2 py-1 rounded shadow-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                    {link.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md hover:bg-destructive/10 text-destructive transition-colors w-full text-left cursor-pointer relative group"
          >
            <LogOut className="h-4.5 w-4.5 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}

            {isCollapsed && (
              <span className="absolute left-14 bg-popover text-destructive border border-destructive/20 px-2 py-1 rounded shadow-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                Logout
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <ManagerAutoLogoutGuard />
      <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className={`bg-card border-r hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 relative z-20 ${isSidebarOpen ? "w-64" : "w-16"}`}>
        <SidebarContent isCollapsed={!isSidebarOpen} />
        <button
          onClick={handleToggleSidebar}
          className="absolute -right-3 top-8 bg-card border border-border rounded-full p-1 shadow-sm hover:bg-secondary text-foreground cursor-pointer z-50 flex items-center justify-center"
        >
          {isSidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      </aside>

      {/* Mobile Drawer */}
      <Drawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} side="left" className="p-0 max-w-[280px] w-full">
        <SidebarContent isCollapsed={false} />
      </Drawer>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-card border-b flex items-center justify-between px-4 sticky top-0 z-10 gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-md hover:bg-secondary text-foreground cursor-pointer md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-bold text-sm tracking-tight text-foreground md:pl-4">FlexSell Manager Portal</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-foreground leading-none">{manager.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{(manager as any).assignedRole || "Staff Manager"}</p>
            </div>
            <Avatar initials={manager.name.substring(0, 2).toUpperCase()} size="sm" className="bg-primary text-primary-foreground h-8 w-8" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/5">
          {children}
        </main>
      </div>
    </div>
  </>
  );
}
