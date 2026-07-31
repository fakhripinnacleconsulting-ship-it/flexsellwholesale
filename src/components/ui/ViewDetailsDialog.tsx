"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ViewDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: Record<string, any>;
}

export function ViewDetailsDialog({ isOpen, onClose, title, data }: ViewDetailsDialogProps) {
  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const renderValue = (val: any, key: string) => {
    if (val === null || val === undefined) return <span className="text-muted-foreground italic">None</span>;
    if (typeof val === "boolean") return val ? <span className="text-success font-semibold">Yes</span> : <span className="text-destructive font-semibold">No</span>;
    if (typeof val === "object") return <pre className="text-xs bg-secondary/30 p-2 rounded max-h-32 overflow-y-auto mt-1 border border-border">{JSON.stringify(val, null, 2)}</pre>;
    if (typeof val === "string") {
      if (val.startsWith("http://") || val.startsWith("https://")) {
        if (val.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) != null) {
          return <img src={val} alt="preview" className="h-16 w-16 object-cover rounded border border-border mt-1" />;
        }
        return <a href={val} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs break-all">{val}</a>;
      }
      
      // Date formatting for ISO strings
      const isDateKey = key.toLowerCase().includes("date") || key === "createdAt" || key === "updatedAt";
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (isDateKey || isoRegex.test(val)) {
        const dateObj = new Date(val);
        if (!isNaN(dateObj.getTime())) {
          return (
            <span className="font-medium whitespace-nowrap">
              {dateObj.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })} 
              <span className="text-muted-foreground ml-1">
                {dateObj.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </span>
          );
        }
      }
    }
    return <span className="break-all">{String(val)}</span>;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
            className="relative w-full max-w-lg bg-card text-card-foreground shadow-2xl rounded-xl border border-border overflow-hidden z-10 flex flex-col max-h-[85vh]"
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-border bg-secondary/20">
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="space-y-4">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {renderValue(value, key)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border bg-secondary/10 flex justify-end">
              <Button onClick={onClose} variant="secondary">
                Close
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
