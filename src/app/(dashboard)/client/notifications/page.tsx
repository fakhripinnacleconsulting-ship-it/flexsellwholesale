"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2, ShoppingBag, Info, AlertTriangle, Tag, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { notificationService } from "@/services/notificationService";
import { useToastStore } from "@/stores/toastStore";
import { ApiError } from "@/lib/apiClient";
import { Notification } from "@/types";

function getIconForType(type: Notification["type"]) {
  switch (type) {
    case "order":
      return <ShoppingBag className="h-4 w-4 text-primary" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "success":
      return <Tag className="h-4 w-4 text-emerald-500" />;
    case "security":
      return <AlertTriangle className="h-4 w-4 text-rose-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

export default function ClientNotificationsPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchNotifications = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getNotifications("customer");
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
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead("customer");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      addToast("All notifications marked as read", "success");
    } catch {
      addToast("Failed to mark notifications as read", "error");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch {
      addToast("Failed to delete notification", "error");
    }
  };

  const handleOpen = async (notif: Notification) => {
    if (!notif.isRead) {
      try {
        await notificationService.markAsRead(notif._id);
        setNotifications((prev) => prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n)));
      } catch {
        // Non-fatal — still navigate even if marking read fails
      }
    }
    if (notif.link) router.push(notif.link);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Notifications
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.` : "You're all caught up."}
          </p>
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="text-xs font-bold cursor-pointer">
            <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-sm">Notification History</CardTitle>
          <CardDescription className="text-xs">Order updates, shipments, and account alerts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No notifications yet" description="Order and account updates will show up here." />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleOpen(notif)}
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-secondary/20 transition-colors ${!notif.isRead ? "bg-primary/5" : ""}`}
                >
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border shrink-0 mt-0.5">
                    {getIconForType(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${!notif.isRead ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>
                        {notif.title}
                      </span>
                      {!notif.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleString("en-IN") : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {notif.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        <button
                          type="button"
                          onClick={(e) => handleDelete(notif._id, e)}
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
