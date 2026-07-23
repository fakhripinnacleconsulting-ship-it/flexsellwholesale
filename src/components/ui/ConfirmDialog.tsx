"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConfirmStore } from "@/stores/confirmStore";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export function ConfirmDialog() {
  const { isOpen, options, close } = useConfirmStore();
  const [isActionLoading, setIsActionLoading] = React.useState(false);
  const prevOpenRef = React.useRef(false);

  // Reset loading when dialog opens (without setState inside effect body)
  if (isOpen && !prevOpenRef.current) {
    // This runs during render, not inside an effect — safe and synchronous
    if (isActionLoading) setIsActionLoading(false);
  }
  prevOpenRef.current = isOpen;

  if (!options) return null;

  const {
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "danger",
    onConfirm,
    onCancel
  } = options;

  const handleConfirm = async () => {
    setIsActionLoading(true);
    try {
      await onConfirm();
      close();
    } catch (err) {
      console.error("Error executing confirm action:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    close();
  };

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <AlertTriangle className="h-6 w-6 text-destructive" />;
      case "warning":
        return <AlertCircle className="h-6 w-6 text-yellow-500" />;
      case "info":
        return <Info className="h-6 w-6 text-primary" />;
      default:
        return <Info className="h-6 w-6 text-primary" />;
    }
  };

  const getConfirmButtonStyles = () => {
    switch (type) {
      case "danger":
        return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
      case "warning":
        return "bg-yellow-500 hover:bg-yellow-600 text-white";
      case "info":
        return "bg-primary text-primary-foreground hover:bg-primary/90";
      default:
        return "bg-primary text-primary-foreground hover:bg-primary/90";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            className="relative z-[100] w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden p-6 text-foreground"
          >
            {/* Close cross */}
            <button
              onClick={handleCancel}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer rounded-sm hover:bg-secondary p-1"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Content header */}
            <div className="flex gap-4 items-start">
              <div className="p-2.5 rounded-full bg-secondary shrink-0">
                {getIcon()}
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="font-bold text-lg leading-none">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isActionLoading}
                className="cursor-pointer font-medium"
              >
                {cancelText}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isActionLoading}
                className={`${getConfirmButtonStyles()} cursor-pointer font-medium`}
              >
                {isActionLoading ? "Processing..." : confirmText}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
