"use client";

import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useToastStore } from "../../stores/toastStore";
import { useRouter } from "next/navigation";

/**
 * Gets the current hour (0-23) in Indian Standard Time (IST / Asia/Kolkata)
 */
function getISTHour(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(hourStr, 10);
  return hour === 24 ? 0 : hour;
}

/**
 * Calculates the exact millisecond timestamp corresponding to 10:00 PM IST for the active cutoff cycle.
 */
function getIST10pmCutoffTimestamp(now = new Date()): number {
  const istNowFormatted = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const istDate = new Date(istNowFormatted);

  const hour = istDate.getHours();
  // If current IST time is between 12:00 AM and 04:59 AM, 10:00 PM cutoff was yesterday
  if (hour < 5) {
    istDate.setDate(istDate.getDate() - 1);
  }

  istDate.setHours(22, 0, 0, 0);

  const diffMs = istDate.getTime() - istNowFormatted.getTime();
  return now.getTime() + diffMs;
}

export function ManagerAutoLogoutGuard() {
  const { manager, logout } = useAuthStore();
  const { addToast } = useToastStore();
  const router = useRouter();

  useEffect(() => {
    // Only enforce for manager/staff accounts
    if (!manager) return;

    const checkAutoLogoutTime = () => {
      const now = new Date();
      const currentIstHour = getISTHour(now);

      // Auto logout window: 10:00 PM (22:00 IST) until 05:00 AM IST
      if (currentIstHour >= 22 || currentIstHour < 5) {
        // Check if manager logged in AFTER the 10:00 PM IST cutoff
        if (manager.lastLogin) {
          const lastLoginTimestamp = new Date(manager.lastLogin).getTime();
          const cutoffTimestamp = getIST10pmCutoffTimestamp(now);

          // If manager logged in AFTER 10:00 PM IST cutoff, allow session without restriction
          if (lastLoginTimestamp >= cutoffTimestamp) {
            return;
          }
        }

        // Session was started before 10:00 PM IST cutoff -> enforce end-of-day logout
        fetch("/api/auth/logout?reason=auto_10pm", { method: "POST" })
          .finally(() => {
            logout();
            addToast("Automated end-of-day logout enforced at 10:00 PM (IST). Please log in again tomorrow.", "warning");
            router.push("/manager/login");
          });
      }
    };

    // Check immediately on mount
    checkAutoLogoutTime();

    // Check every 30 minutes (30 * 60 * 1000 = 1,800,000 ms)
    const interval = setInterval(checkAutoLogoutTime, 1800000);
    return () => clearInterval(interval);
  }, [manager, logout, addToast, router]);

  return null;
}
