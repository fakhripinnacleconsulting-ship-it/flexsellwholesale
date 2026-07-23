import { PushSubscriptionInfo } from "@/types";

const PUBLIC_VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa1F-e-w_X2fG7T0B-B8Xw81hF0j9gX88h8g8g8g8g8g8g8g8g8g8g8g8";
const PUSH_STORAGE_KEY = "flexsell-push-subscriptions-storage";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushService = {
  getPermissionState(): NotificationPermission | "unsupported" {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }
    return Notification.permission;
  },

  async requestPermissionAndSubscribe(role: "customer" | "admin" = "customer", userId: string = "current"): Promise<{ success: boolean; message: string }> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { success: false, message: "Browser push notifications are not supported by your browser." };
    }

    const currentPermission = Notification.permission;
    if (currentPermission === "denied") {
      return { success: false, message: "Permission is blocked in browser settings. Please enable notifications in site settings." };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { success: false, message: "Browser notification permission was not granted." };
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey as unknown as BufferSource,
        });
      }

      const subObj = subscription.toJSON();
      const payload: PushSubscriptionInfo = {
        userId,
        role,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subObj.keys?.p256dh || "",
          auth: subObj.keys?.auth || "",
        },
        userAgent: navigator.userAgent,
        isActive: true,
      };

      // Save to server / local storage
      try {
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.warn("Server push sub failed, saving to local storage fallback", err);
        const raw = localStorage.getItem(PUSH_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.push(payload);
        localStorage.setItem(PUSH_STORAGE_KEY, JSON.stringify(list));
      }

      return { success: true, message: "Browser push notifications enabled successfully!" };
    } catch (err: any) {
      console.error("Failed to subscribe to Web Push:", err);
      return { success: false, message: err.message || "Failed to subscribe to push notifications." };
    }
  },

  async unsubscribePush(userId: string = "current"): Promise<void> {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint, userId }),
        });
      }
    } catch (err) {
      console.warn("Unsubscribe push warning:", err);
    }
  }
};
