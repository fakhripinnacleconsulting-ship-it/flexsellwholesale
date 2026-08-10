"use client";

import React, { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useRouter } from "next/navigation";

export function ManagerAutoLogoutGuard() {
  const { manager, logout } = useAuthStore();
  const { addToast } = useToastStore();
  const router = useRouter();

  useEffect(() => {
    // Only enforce for manager/staff accounts
    if (!manager) return;

    const checkAutoLogoutTime = () => {
      const now = new Date();
      const currentHour = now.getHours(); // 0-23
      
      // Auto logout at 10:00 PM (22:00) until 05:00 AM
      if (currentHour >= 22 || currentHour < 5) {
        fetch("/api/auth/logout?reason=auto_10pm", { method: "POST" })
          .finally(() => {
            logout();
            addToast("Automated end-of-day logout enforced at 10:00 PM. Please log in again tomorrow.", "warning");
            router.push("/manager/login");
          });
      }
    };

    // Check immediately on mount
    checkAutoLogoutTime();

    // Check every 30 seconds
    const interval = setInterval(checkAutoLogoutTime, 30000);
    return () => clearInterval(interval);
  }, [manager, logout, addToast, router]);

  return null;
}
