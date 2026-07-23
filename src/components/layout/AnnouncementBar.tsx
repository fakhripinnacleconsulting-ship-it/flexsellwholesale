"use client";

import * as React from "react";
import { X, Sparkles } from "lucide-react";

interface AnnouncementBarProps {
  messages: string[];
}

export function AnnouncementBar({ messages }: AnnouncementBarProps) {
  const [isDismissed, setIsDismissed] = React.useState(false);

  if (isDismissed || !messages || messages.length === 0) return null;

  // Repeat the messages to ensure there is enough horizontal length for marquee
  const repeatCount = messages.length === 1 ? 6 : messages.length < 3 ? 4 : 2;
  const singleHalf = Array(repeatCount).fill(messages).flat();

  return (
    <div className="bg-gradient-to-r from-primary via-emerald-600 to-primary text-primary-foreground py-2 relative overflow-hidden select-none z-45 w-full border-b border-primary-foreground/10 flex items-center">
      <div className="flex w-max whitespace-nowrap animate-marquee pause-marquee flex-1">
        {/* First Half */}
        <div className="flex items-center gap-16 px-8">
          {singleHalf.map((msg, idx) => (
            <span key={`first-${idx}`} className="text-xs sm:text-sm font-semibold flex items-center gap-3">
              <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span>{msg}</span>
              <span className="text-primary-foreground/30 font-light select-none">/</span>
            </span>
          ))}
        </div>

        {/* Second Half (Clone for seamless loop) */}
        <div className="flex items-center gap-16 px-8">
          {singleHalf.map((msg, idx) => (
            <span key={`second-${idx}`} className="text-xs sm:text-sm font-semibold flex items-center gap-3">
              <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span>{msg}</span>
              <span className="text-primary-foreground/30 font-light select-none">/</span>
            </span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="px-3 text-primary-foreground/80 hover:text-primary-foreground transition-colors cursor-pointer bg-primary z-50 h-full flex items-center"
        aria-label="Dismiss Announcement"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
