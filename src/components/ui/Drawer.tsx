"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}

export function Drawer({ isOpen, onClose, children, side = "left", className }: DrawerProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const slideVariants = {
    closed: {
      x: side === "left" ? "-100%" : "100%",
      transition: { type: "tween" as const, duration: 0.3, ease: "easeInOut" as const }
    },
    open: {
      x: 0,
      transition: { type: "tween" as const, duration: 0.3, ease: "easeInOut" as const }
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md z-[9999]"
            onClick={onClose}
          />
          
          {/* Drawer Panel */}
          <motion.div
            initial="closed"
            animate="open"
            exit="closed"
            variants={slideVariants}
            className={cn(
              "fixed z-[10000] h-full w-[85vw] max-w-xs bg-background text-foreground p-5 shadow-2xl overflow-y-auto border-border flex flex-col",
              side === "left" ? "left-0 border-r" : "right-0 border-l",
              className
            )}
          >
            <button 
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 opacity-80 hover:opacity-100 transition-opacity focus:outline-none bg-secondary text-foreground cursor-pointer z-30 shadow-sm"
              title="Close Menu"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
