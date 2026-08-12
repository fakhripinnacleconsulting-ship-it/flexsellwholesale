"use client";

import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useToastStore } from "../../stores/toastStore";
import { useRouter } from "next/navigation";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 5 hours 30 minutes in ms

/**
 * Gets the current hour (0-23) in Indian Standard Time (IST / Asia/Kolkata)
 */
function getISTHour(now = new Date()): number {
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return istDate.getUTCHours();
}

/**
 * Calculates the exact millisecond timestamp corresponding to 10:00 PM IST for the active cutoff cycle.
 */
function getIST10pmCutoffTimestamp(now = new Date()): number {
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  const hour = istDate.getUTCHours();

  let year = istDate.getUTCFullYear();
  let month = istDate.getUTCMonth();
  let day = istDate.getUTCDate();

  // If current IST time is between 12:00 AM and 04:59 AM, 10:00 PM cutoff was yesterday IST
  if (hour < 5) {
    day -= 1;
  }

  // 10:00 PM IST is 22:00:00.000 in IST. Subtract IST_OFFSET_MS to get UTC epoch timestamp.
  return Date.UTC(year, month, day, 22, 0, 0, 0) - IST_OFFSET_MS;
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

          // 5-minute clock-skew tolerance buffer for client device clock differences
          const CLOCK_SKEW_BUFFER_MS = 5 * 60 * 1000;

          // If manager logged in AFTER 10:00 PM IST cutoff (with 5-min skew tolerance), allow session
          if (lastLoginTimestamp >= cutoffTimestamp - CLOCK_SKEW_BUFFER_MS) {
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
