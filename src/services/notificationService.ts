import { apiClient, isMockMode } from "@/lib/apiClient";
import { Notification } from "@/types";

const NOTIFICATIONS_STORAGE_KEY = "flexsell-notifications-storage";

function getLocalNotifications(role: "customer" | "admin" = "customer", customerId?: string): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const list: Notification[] = raw ? JSON.parse(raw) : [
      {
        _id: "notif-welcome",
        customerId: "active-user",
        recipientRole: "customer",
        title: "Welcome to FlexSell Wholesale",
        message: "Your wholesale B2B buyer account is active. Explore tiered volume pricing and catalog specs.",
        type: "info",
        isRead: false,
        link: "/client/profile",
        createdAt: new Date().toISOString()
      },
      {
        _id: "notif-admin-welcome",
        customerId: "admin",
        recipientRole: "admin",
        title: "Admin Notification Drawer Connected",
        message: "Real-time system events, new order alerts, and RFQs will appear here.",
        type: "info",
        isRead: false,
        link: "/admin/orders",
        createdAt: new Date().toISOString()
      }
    ];

    return list.filter(n => {
      if (role === "admin") return n.recipientRole === "admin" || n.customerId === "admin";
      return n.recipientRole !== "admin";
    });
  } catch (err) {
    console.error("Failed to read notifications from localStorage", err);
    return [];
  }
}

function saveLocalNotifications(notifications: Notification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
  } catch (err) {
    console.error("Failed to save notifications to localStorage", err);
  }
}

export const notificationService = {
  async getNotifications(role: "customer" | "admin" = "customer", customerId?: string): Promise<Notification[]> {
    if (isMockMode) {
      return getLocalNotifications(role, customerId);
    }
    const query = role === "admin" ? "?role=admin" : customerId ? `?customerId=${customerId}` : "";
    return apiClient.get<Notification[]>(`/notifications${query}`);
  },

  async markAsRead(id: string): Promise<Notification> {
    if (isMockMode) {
      const notifications = getLocalNotifications();
      let updatedNotif: Notification | null = null;
      const updatedList = notifications.map(n => {
        if (n._id === id) {
          updatedNotif = { ...n, isRead: true };
          return updatedNotif;
        }
        return n;
      });
      saveLocalNotifications(updatedList);
      if (!updatedNotif) return { _id: id, customerId: "active-user", title: "", message: "", type: "info", isRead: true };
      return updatedNotif;
    }
    return apiClient.put<Notification>("/notifications", { _id: id });
  },

  async markAllAsRead(role: "customer" | "admin" = "customer"): Promise<void> {
    if (isMockMode) {
      const notifications = getLocalNotifications();
      const updatedList = notifications.map(n => ({ ...n, isRead: true }));
      saveLocalNotifications(updatedList);
      return;
    }
    return apiClient.put<void>("/notifications", { markAll: true, role });
  },

  async deleteNotification(id: string): Promise<void> {
    if (isMockMode) {
      const notifications = getLocalNotifications();
      saveLocalNotifications(notifications.filter(n => n._id !== id));
      return;
    }
    return apiClient.delete<void>(`/notifications?id=${id}`);
  }
};
