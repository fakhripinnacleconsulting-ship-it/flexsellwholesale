"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, ShoppingBag, Info, AlertTriangle, Tag, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { notificationService } from "@/services/notificationService";
import { ApiError } from "@/lib/apiClient";
import { Notification } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface NotificationPopoverProps {
  role?: "customer" | "admin";
  customerId?: string;
}

export function NotificationPopover({ role = "customer", customerId }: NotificationPopoverProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const fetchNotifications = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getNotifications(role, customerId);
      setNotifications(data || []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNotifications([]);
        return;
      }
      console.error("Failed to load notifications", err);
    } finally {
      setIsLoading(false);
    }
  }, [role, customerId]);

  React.useEffect(() => {
    fetchNotifications();
    // Poll notifications silently every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside and Escape key handler
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAllAsRead(role);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif._id);
        setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      } catch (e) {
        console.error(e);
      }
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case "order":
        return <ShoppingBag className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "promo":
        return <Tag className="h-4 w-4 text-emerald-500" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-primary" />;
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const date = new Date(isoString);
      const diffMs = new Date().getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (e) {
      return "";
    }
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Bell Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className="relative cursor-pointer h-9 w-9 p-0 flex items-center justify-center text-foreground hover:bg-secondary transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            key={unreadCount}
            className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-black shadow-sm"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}
      </Button>

      {/* Popover Menu Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-hidden text-foreground"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>

            {/* Content List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
              {isLoading && notifications.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading notifications...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">All caught up!</p>
                  <p className="text-xs text-muted-foreground">You have no unread notifications.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 transition-colors cursor-pointer flex gap-3 items-start group relative ${
                      !notif.isRead ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/40"
                    }`}
                  >
                    {/* Unread blue dot indicator */}
                    {!notif.isRead && (
                      <span className="absolute top-4 left-2.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}

                    <div className="p-2 rounded-xl bg-secondary/60 shrink-0 mt-0.5">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-baseline justify-between gap-1">
                        <h4 className={`text-xs font-bold truncate ${!notif.isRead ? "text-foreground font-extrabold" : "text-foreground/80"}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>

                      {notif.link && (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-primary mt-1.5 group-hover:underline">
                          View details <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1 items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(notif._id, e)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        title="Delete notification"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
