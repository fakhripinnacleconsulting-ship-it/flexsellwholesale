"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => onOpenChange?.(false)}
          />
          {children}
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogContent({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      transition={{ type: "spring", duration: 0.3 }}
      className={`relative z-50 w-full max-w-lg bg-card border border-border rounded-xl shadow-xl overflow-hidden text-foreground ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function DialogHeader({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-6 border-b border-border space-y-1.5 ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <h3 className={`font-bold text-lg leading-none tracking-tight ${className}`}>
      {children}
    </h3>
  );
}

export function DialogDescription({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={`text-sm text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

export function DialogFooter({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`p-6 border-t border-border flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 ${className}`}>
      {children}
    </div>
  );
}

export function DialogClose({ onClick, className = "" }: { onClick?: () => void, className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute right-4 top-4 text-muted-foreground hover:text-foreground cursor-pointer rounded-sm hover:bg-secondary p-1 ${className}`}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </button>
  );
}
