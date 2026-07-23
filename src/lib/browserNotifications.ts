"use client";

export type SystemNotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export function getSystemOSNotificationPermission(): SystemNotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as SystemNotificationPermissionState;
}

export async function requestSystemOSNotificationPermission(): Promise<SystemNotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as SystemNotificationPermissionState;
  } catch (err) {
    console.error("Failed to request system notification permission:", err);
    return Notification.permission as SystemNotificationPermissionState;
  }
}

export async function sendSystemOSNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    link?: string;
  }
): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    const notifOptions: any = {
      body: options?.body || "",
      icon: options?.icon || "/Flexsell%20Logo.png",
      badge: "/icon.png",
      tag: options?.tag || `flexsell-${Date.now()}`,
      data: { url: options?.link || "/" },
      vibrate: [200, 100, 200],
    };

    // 1. Try Service Worker showNotification (Bypasses browser tab isolation & shows native OS desktop toasts on Windows/Mac)
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && "showNotification" in registration) {
          await registration.showNotification(title, notifOptions);
          return;
        }
      } catch (err) {
        console.warn("ServiceWorker showNotification failed, using fallback:", err);
      }
    }

    // 2. Fallback to window.Notification constructor
    try {
      const notif = new window.Notification(title, notifOptions);
      if (options?.link) {
        notif.onclick = (e) => {
          e.preventDefault();
          window.focus();
          window.location.href = options.link!;
          notif.close();
        };
      }
    } catch (err) {
      console.warn("Could not fire native OS browser notification:", err);
    }
  }
}
