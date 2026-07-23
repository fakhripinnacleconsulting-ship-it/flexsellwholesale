"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CmsTabType } from "./types";

interface CmsTabsNavProps {
  activeTab: CmsTabType;
  onSelectTab: (tab: CmsTabType) => void;
}

export function CmsTabsNav({ activeTab, onSelectTab }: CmsTabsNavProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [hasMoved, setHasMoved] = React.useState(false);

  const tabsList: { id: CmsTabType; label: string }[] = [
    { id: "hero", label: "Hero Banners" },
    { id: "announcements", label: "Announcements" },
    { id: "trust", label: "Trust Stats" },
    { id: "wholesale_biz", label: "Wholesale Business" },
    { id: "dropship_biz", label: "Dropship Business" },
    { id: "testimonials", label: "Customer Reviews" },
    { id: "partners", label: "Brand Partners" },
    { id: "blogs", label: "Blogs & Articles" },
    { id: "dropship_page", label: "Dropshipping Page" },
    { id: "faqs", label: "FAQs Manager" },
    { id: "policies", label: "Policies Manager" },
    { id: "footer", label: "Footer Settings" },
  ];

  // Mouse Drag to Scroll
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

  // Arrow buttons scroll
  const scrollContainer = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -250 : 250;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  // Determine active state considering sub-tabs for testimonials
  const isTabActive = (tabId: CmsTabType) => {
    if (tabId === "testimonials") {
      return (
        activeTab === "testimonials" ||
        activeTab === "testimonials_wholesale" ||
        activeTab === "testimonials_dropship" ||
        activeTab === "testimonials_client"
      );
    }
    return activeTab === tabId;
  };

  return (
    <div className="relative flex items-center bg-card border rounded-xl p-1 shadow-sm">
      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => scrollContainer("left")}
        className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0 transition-colors"
        title="Scroll Left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable Tabs Container (Touch + Mouse Drag + Mouse Wheel) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeaveOrUp}
        onMouseUp={handleMouseLeaveOrUp}
        onMouseMove={handleMouseMove}
        onWheel={handleWheel}
        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1 py-1 select-none cursor-grab active:cursor-grabbing touch-pan-x flex-1 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tabsList.map((tab) => {
          const active = isTabActive(tab.id);
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!hasMoved) {
                  onSelectTab(tab.id);
                }
              }}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => scrollContainer("right")}
        className="p-2 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-lg cursor-pointer shrink-0 transition-colors"
        title="Scroll Right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
