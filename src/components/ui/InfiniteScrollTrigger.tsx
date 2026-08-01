"use client";

import * as React from "react";

interface InfiniteScrollTriggerProps {
  onIntersect: () => void;
  hasMore: boolean;
}

export function InfiniteScrollTrigger({ onIntersect, hasMore }: InfiniteScrollTriggerProps) {
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = triggerRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onIntersect();
        }
      },
      {
        rootMargin: "800px", // Trigger way before reaching the bottom for a seamless experience
      }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [hasMore, onIntersect]);

  if (!hasMore) return null;

  return (
    <div ref={triggerRef} className="w-full h-4" aria-hidden="true" />
  );
}
