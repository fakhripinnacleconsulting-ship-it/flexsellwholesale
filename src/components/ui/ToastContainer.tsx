"use client";

import * as React from "react";
import { useToastStore } from "@/stores/toastStore";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />,
    error: <XCircle className="h-5 w-5 text-rose-500 flex-shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />,
  };

  const bgClasses = {
    success: "border-emerald-500/20 bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300",
    error: "border-rose-500/20 bg-rose-50/90 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300",
    warning: "border-amber-500/20 bg-amber-50/90 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300",
    info: "border-blue-500/20 bg-blue-50/90 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300",
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${bgClasses[toast.type]}`}
          role="alert"
        >
          {icons[toast.type]}
          <div className="flex-1 text-sm font-semibold leading-snug">{toast.message}</div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground rounded-lg p-0.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
