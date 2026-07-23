"use client";

import * as React from "react";
import { requestSystemOSNotificationPermission } from "@/lib/browserNotifications";

export function NotificationInitializer() {
  React.useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Prompt user for notification permission if not yet decided
    if (Notification.permission === "default") {
      const timer = setTimeout(() => {
        requestSystemOSNotificationPermission().catch((err) => {
          console.warn("Auto system notification prompt skipped:", err);
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
