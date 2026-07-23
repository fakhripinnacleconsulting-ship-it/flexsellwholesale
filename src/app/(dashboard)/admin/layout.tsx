"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, FolderTree, Users,
  Settings, Tags, CreditCard, Menu, Percent, FileText, LogOut,
  ChevronLeft, ChevronRight, MessageSquare, MessageSquarePlus, Truck, Image as ImageIcon, Layers, Megaphone,
  BarChart, Bell, X, Check
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Avatar } from "@/components/ui/Avatar";
import { Drawer } from "@/components/ui/Drawer";
import { notificationService } from "@/services/notificationService";
import { Notification } from "@/types";

function AdminNotificationBell() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);

  const fetchNotifs = React.useCallback(async () => {
    try {
      const list = await notificationService.getNotifications("admin");
      setNotifications(list);
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    await notificationService.markAsRead(id);
    fetchNotifs();
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead("admin");
    fetchNotifs();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-secondary text-foreground cursor-pointer transition-colors border border-border bg-card"
        title="Admin Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-bold text-xs">Admin Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border text-xs">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">
                No notifications right now.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  className={`p-3.5 transition-colors flex items-start justify-between gap-2 ${
                    notif.isRead ? "bg-card opacity-75" : "bg-primary/5 font-medium"
                  }`}
                >
                  <div className="space-y-1 pr-2">
                    <span className="font-bold text-foreground block text-xs">{notif.title}</span>
                    <p className="text-[11px] text-muted-foreground leading-normal">{notif.message}</p>
                    {notif.link && (
                      <Link
                        href={notif.link}
                        onClick={() => {
                          handleMarkRead(notif._id);
                          setIsOpen(false);
                        }}
                        className="inline-block text-[11px] text-primary hover:underline font-bold mt-1"
                      >
                        View Details &rarr;
                      </Link>
                    )}
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkRead(notif._id)}
                      title="Mark as read"
                      className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary cursor-pointer shrink-0"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const pathname = usePathname();
  const logout = useAuthStore((state) => state.logout);

  React.useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_open");
    if (saved !== null) {
      setIsSidebarOpen(saved === "true");
    }
  }, []);

  const handleToggleSidebar = () => {
    const nextState = !isSidebarOpen;
    setIsSidebarOpen(nextState);
    localStorage.setItem("admin_sidebar_open", String(nextState));
  };

  const sidebarLinks = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Analytics", href: "/admin/analytics", icon: BarChart },
    { name: "Products", href: "/admin/products", icon: ShoppingBag },
    { name: "Categories", href: "/admin/categories", icon: FolderTree },
    { name: "Collections", href: "/admin/collections", icon: Layers },
    { name: "Orders", href: "/admin/orders", icon: CreditCard },
    { name: "Invoices", href: "/admin/invoices", icon: FileText },
    { name: "Customers", href: "/admin/customers", icon: Users },
    { name: "Reviews", href: "/admin/reviews", icon: MessageSquare },
    { name: "Inquiries", href: "/admin/inquiries", icon: MessageSquarePlus },
    { name: "HSN Management", href: "/admin/hsn", icon: Percent },
    { name: "Shipping Options", href: "/admin/shipping", icon: Truck },
    { name: "Coupons", href: "/admin/coupons", icon: Tags },
    { name: "Website CMS", href: "/admin/cms", icon: FileText },
    { name: "Settings", href: "/admin/settings", icon: Settings },
  ];

  // Auto-close mobile drawer when pathname changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const SidebarContent = ({ isCollapsed }: { isCollapsed?: boolean }) => (
    <div className="flex flex-col h-full select-none">
      <div className="p-4 border-b flex items-center justify-between min-h-[73px]">
        {!isCollapsed ? (
          <Link href="/admin" className="flex flex-col gap-1 items-start overflow-hidden">
            <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={150} height={40} className="h-8 md:h-10 w-auto object-contain" />
            <span className="text-xs text-muted-foreground uppercase tracking-widest ml-1">Admin Panel</span>
          </Link>
        ) : (
          <Link href="/admin" className="mx-auto font-black text-xl text-primary font-sans h-8 flex items-center justify-center">
            FS
          </Link>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col justify-between">
        <nav className="space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors relative group ${isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-secondary hover:text-primary text-foreground"
                  }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="transition-opacity duration-300 opacity-100">{link.name}</span>}

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
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}

            {/* Tooltip on hover when collapsed */}
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
    <div className="min-h-screen flex bg-secondary/10">
      {/* Desktop Sidebar (Collapsible) */}
      <aside className={`bg-card border-r hidden md:flex flex-col sticky top-0 h-screen transition-all duration-300 ${isSidebarOpen ? "w-64" : "w-16"
        }`}>
        <SidebarContent isCollapsed={!isSidebarOpen} />
      </aside>

      {/* Mobile Drawer Navigation */}
      <Drawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} side="left" className="p-0 max-w-[280px] w-full">
        <SidebarContent isCollapsed={false} />
      </Drawer>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Admin Topbar */}
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-md hover:bg-secondary text-foreground cursor-pointer"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Sidebar toggle button (Chevron Right / Chevron Left) */}
            <button
              onClick={handleToggleSidebar}
              className="hidden md:flex p-1.5 rounded-md hover:bg-secondary/80 text-foreground cursor-pointer border items-center justify-center h-9 w-9 bg-card"
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? (
                <ChevronLeft className="h-4.5 w-4.5" />
              ) : (
                <ChevronRight className="h-4.5 w-4.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <Link href="/" target="_blank" className="text-sm font-medium text-primary hover:underline">
              View Storefront &rarr;
            </Link>

            {/* Admin Notification Bell */}
            <AdminNotificationBell />

            <Avatar initials="A" size="sm" className="bg-primary text-primary-foreground" />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
