"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";
import { Bell, CheckCheck, Trash2, Calendar, ShoppingBag, Info, AlertTriangle, ShieldCheck } from "lucide-react";
import { notificationService } from "@/services/notificationService";

export default function ClientNotificationsPage() {
  const { addToast } = useToastStore();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (err: unknown) {
      console.error(err);
      addToast((err as any).message || "Failed to load notifications", "error");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      fetchNotifications();
      addToast("Notification marked as read", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to mark as read", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      fetchNotifications();
      addToast("Notification deleted", "success");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to delete notification", "error");
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "order":
        return <ShoppingBag className="h-5 w-5 text-purple-500" />;
      case "success":
        return <ShieldCheck className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-8 text-foreground max-w-4xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications Log</h1>
          <p className="text-muted-foreground mt-1">Keep track of order milestones and administrative broadcasts.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading your notifications...</div>
      ) : notifications.length === 0 ? (
        <Card className="border border-border">
          <CardContent className="pt-10 pb-10 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-bold">Inbox is empty</h3>
            <p className="text-muted-foreground text-sm mt-1">
              You're all caught up! There are no notifications to show right now.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notif) => (
            <Card key={notif._id} className={`border ${notif.isRead ? "border-border bg-card/40" : "border-primary/40 bg-primary/[0.01] shadow-sm"}`}>
              <CardContent className="p-4 sm:p-5 flex gap-4 items-start text-xs">
                <div className="bg-secondary/50 p-2.5 rounded-lg border border-border">
                  {getNotifIcon(notif.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-bold ${notif.isRead ? "text-foreground/80" : "text-foreground"}`}>
                      {notif.title}
                    </h3>
                    <div className="flex gap-2 items-center">
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-semibold">
                        <Calendar className="h-3 w-3" /> {new Date(notif.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">{notif.message}</p>
                  
                  <div className="flex gap-2 pt-2 justify-end">
                    {!notif.isRead && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary flex items-center gap-1" onClick={() => handleMarkAsRead(notif._id)}>
                        <CheckCheck className="h-3.5 w-3.5" /> Mark as Read
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-destructive hover:bg-destructive/5 hover:text-destructive flex items-center gap-1" onClick={() => handleDelete(notif._id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
