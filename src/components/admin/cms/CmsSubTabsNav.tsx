"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CmsTabType } from "./types";

export interface SubTabItem {
  id: CmsTabType;
  label: string;
  icon: string;
}

interface CmsSubTabsNavProps {
  subTabs: SubTabItem[];
  activeTab: CmsTabType;
  getActiveSubTab: () => CmsTabType;
  onSelectSubTab: (tabId: CmsTabType) => void;
}

export function CmsSubTabsNav({
  subTabs,
  getActiveSubTab,
  onSelectSubTab,
}: CmsSubTabsNavProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [hasMoved, setHasMoved] = React.useState(false);

  // Mouse Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsMouseDown(true);
    setHasMoved(false);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.8;
    if (Math.abs(walk) > 5) setHasMoved(true);
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // Mouse Wheel Horizontal Scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (!scrollRef.current) return;
    if (e.deltaY !== 0) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  // Chevron Arrow Scroll Buttons
  const scrollContainer = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -220 : 220;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  const activeSubId = getActiveSubTab();

  return (
    <div className="relative flex items-center bg-muted/40 border border-border/80 rounded-xl p-1 mb-4 select-none">
      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => scrollContainer("left")}
        className="p-1.5 hover:bg-background/80 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0 transition-colors"
        title="Slide Left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable Sub-Tabs Container (Touch + Mouse Drag + Mouse Wheel + No Scrollbar) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1 py-0.5 cursor-grab active:cursor-grabbing touch-pan-x flex-1 scroll-smooth [::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {subTabs.map((sub) => {
          const isActive = activeSubId === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => {
                if (!hasMoved) {
                  onSelectSubTab(sub.id);
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer ${
                isActive
                  ? "bg-background text-primary shadow-xs border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              <span>{sub.icon}</span>
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => scrollContainer("right")}
        className="p-1.5 hover:bg-background/80 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0 transition-colors"
        title="Slide Right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
