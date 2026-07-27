"use client";

import * as React from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import { Star, Quote, ChevronLeft, ChevronRight, CheckCircle2, Video, ImageIcon, Building2, Truck, Users, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface TestimonialItem {
  id?: string;
  name: string;
  business: string;
  location: string;
  rating: number;
  text: string;
  contentType: "text" | "image" | "video";
  mediaUrl?: string;
  mediaUpload?: string;
  avatarUrl?: string;
  avatarUpload?: string;
  isActive?: boolean;
}

interface TestimonialsSectionProps {
  title?: string;
  subtitle?: string;
  testimonials?: TestimonialItem[];
  wholesaleTestimonials?: TestimonialItem[];
  dropshipTestimonials?: TestimonialItem[];
  clientTestimonials?: TestimonialItem[];
  type?: "wholesale" | "dropshipper" | "client";
}

export function TestimonialsSection({
  title,
  subtitle,
  testimonials,
  wholesaleTestimonials,
  dropshipTestimonials,
  clientTestimonials,
  type = "wholesale"
}: TestimonialsSectionProps) {
  // Active Tab state for 3-Tab unified frame
  const hasMultipleTabs = Boolean(wholesaleTestimonials || dropshipTestimonials || clientTestimonials);
  const [activeTab, setActiveTab] = React.useState<"wholesale" | "dropshipper" | "client">(type);

  const [isHovered, setIsHovered] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [scrollSnaps, setScrollSnaps] = React.useState<number[]>([]);

  // Initialize Embla Carousel with loop & drag physics
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
    dragFree: false,
  });

  const defaultTestimonials: TestimonialItem[] = [
    {
      name: "Rajesh Sharma",
      business: "Sharma Traders",
      location: "Indore, MP",
      rating: 5,
      text: "FlexSell changed my kitchen gadget retail business. Direct Bhopal warehouse cargo pricing gave me a 35% margin boost!",
      contentType: "text"
    },
    {
      name: "Ananya Patel",
      business: "SmartDrop Store",
      location: "Ahmedabad, Gujarat",
      rating: 5,
      text: "The dropshipping fulfillment speed is unmatched. My Shopify orders get dispatched within 24 hours with custom packaging.",
      contentType: "text"
    },
    {
      name: "Vikram Malhotra",
      business: "Malhotra Gifts",
      location: "Jaipur, Rajasthan",
      rating: 5,
      text: "Zero damaged goods in transit. Their packaging line quality screening makes buying container cargo safe and easy.",
      contentType: "text"
    },
    {
      name: "Suresh Gupta",
      business: "Gupta Utilities",
      location: "Delhi NCR",
      rating: 5,
      text: "Instant GST invoices with tax credit. Ordering bulk inventory directly from Bhopal saved us thousands every month.",
      contentType: "text"
    },
    {
      name: "Pooja Verma",
      business: "TrendMart E-Com",
      location: "Mumbai, MH",
      rating: 5,
      text: "Extremely reliable dropship partnership! All product listings come pre-vetted with high profit margins.",
      contentType: "text"
    }
  ];

  // Determine active dataset based on activeTab selection
  const rawDataset = React.useMemo(() => {
    if (hasMultipleTabs) {
      if (activeTab === "wholesale") return wholesaleTestimonials || [];
      if (activeTab === "dropshipper") return dropshipTestimonials || [];
      if (activeTab === "client") return clientTestimonials || [];
    }
    return testimonials || defaultTestimonials;
  }, [hasMultipleTabs, activeTab, wholesaleTestimonials, dropshipTestimonials, clientTestimonials, testimonials]);

  const activeItems = rawDataset.filter((item) => item.isActive !== false);

  const scrollPrev = React.useCallback(() => emblaApi && emblaApi.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi && emblaApi.scrollNext(), [emblaApi]);
  const scrollTo = React.useCallback((index: number) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);

  const onSelect = React.useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  // Autoplay timer (4 seconds)
  React.useEffect(() => {
    if (!emblaApi || isHovered) return;
    const interval = setInterval(() => {
      emblaApi.scrollNext();
    }, 4000);
    return () => clearInterval(interval);
  }, [emblaApi, isHovered]);

  const sectionTitle = title || (
    activeTab === "dropshipper"
      ? "Dropship Partner Stories"
      : activeTab === "client"
        ? "Retail Client Reviews"
        : "Wholesale Buyer Stories"
  );
  const sectionSubtitle = subtitle || "Verified reviews from commercial buyers, dropshippers, and retail clients using FlexSell.";

  return (
    <section
      className="mx-auto max-w-8xl px-4 md:px-6 w-full py-12 select-none overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header Bar with 3-Tab Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b pb-4 border-border/60 gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            {sectionTitle}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{sectionSubtitle}</p>
        </div>

        {/* 3-Tab Pills Switcher */}
        {hasMultipleTabs && (
          <div className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded-xl border border-border">
            {[
              { id: "wholesale", label: "Wholesale Buyers", icon: Building2 },
              { id: "dropshipper", label: "Dropshipping Partners", icon: Truck },
              { id: "client", label: "Retail Clients", icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Embla Navigation Arrows */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={scrollPrev}
            className="p-3 rounded-full border border-border bg-card hover:bg-secondary text-foreground shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={scrollNext}
            className="p-3 rounded-full border border-border bg-card hover:bg-secondary text-foreground shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Embla Carousel Viewport */}
      <AnimatePresence mode="wait">
        {activeItems.length > 0 ? (
          <div className="overflow-hidden py-4 cursor-grab active:cursor-grabbing" ref={emblaRef}>
            <div className="flex gap-6">
              {activeItems.map((item, idx) => {
                const activeMedia = item.mediaUpload || item.mediaUrl || "";
                const activeAvatar = item.avatarUpload || item.avatarUrl || "";

                return (
                  <div
                    key={`${activeTab}-${idx}`}
                    className="flex-[0_0_260px] sm:flex-[0_0_290px] md:flex-[0_0_310px] aspect-[9/16] max-h-[520px] min-h-[460px] relative rounded-3xl overflow-hidden shadow-xl border border-border/80 bg-card hover:border-emerald-500/60 transition-all duration-300 group select-none flex flex-col justify-between"
                  >
                    {/* Dynamic Media Background if uploaded */}
                    {activeMedia ? (
                      <div className="absolute inset-0 z-0 bg-slate-950">
                        {item.contentType === "video" && (activeMedia.includes("http") || activeMedia.includes("video")) ? (
                          <iframe
                            src={activeMedia}
                            className="w-full h-full object-cover opacity-90 pointer-events-none"
                            title={item.name}
                            allowFullScreen
                          />
                        ) : (
                          <img
                            src={activeMedia}
                            alt={item.name}
                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700 opacity-85"
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-black/60 pointer-events-none z-10" />
                      </div>
                    ) : null}

                    {/* Top Bar: Dynamic Star Rating & Optional Content Type Tag */}
                    <div className="relative z-20 p-5 flex justify-between items-center">
                      <div className="flex items-center gap-1 bg-background/80 dark:bg-black/60 backdrop-blur-md border border-border/60 px-3 py-1 rounded-full shadow-xs">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < (item.rating || 5) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                              }`}
                          />
                        ))}
                      </div>

                      {item.contentType !== "text" && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 backdrop-blur-md flex items-center gap-1">
                          {item.contentType === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                          {item.contentType}
                        </span>
                      )}
                    </div>

                    {/* Middle: Dynamic Review Text Box */}
                    <div className="relative z-20 px-5 my-auto">
                      <div className={`p-5 rounded-2xl shadow-lg space-y-2 border ${activeMedia
                          ? "bg-slate-950/85 backdrop-blur-md border-white/20 text-white"
                          : "bg-muted/40 dark:bg-slate-900/60 border-border/60 text-foreground"
                        }`}>
                        <Quote className="h-5 w-5 text-primary opacity-80 mb-1" />
                        <p className="text-xs sm:text-sm italic font-medium leading-relaxed line-clamp-5">
                          "{item.text}"
                        </p>
                      </div>
                    </div>

                    {/* Bottom: Dynamic Customer Profile Overlay */}
                    <div className={`relative z-20 p-5 pt-4 flex items-center gap-3 border-t ${activeMedia ? "bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent border-white/10" : "border-border/60 bg-card"
                      }`}>
                      {activeAvatar ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden relative border border-primary/30 shrink-0 shadow-xs">
                          <img src={activeAvatar} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center border border-primary/20 shrink-0">
                          {item.name.charAt(0)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className={`font-bold text-xs sm:text-sm flex items-center gap-1.5 truncate ${activeMedia ? "text-white" : "text-foreground"
                          }`}>
                          <span>{item.name}</span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                        </h4>
                        <p className={`text-[11px] truncate font-medium ${activeMedia ? "text-slate-300" : "text-muted-foreground"
                          }`}>
                          {item.business} • {item.location}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border rounded-2xl bg-card text-muted-foreground text-xs font-medium">
            No testimonials added for this category yet.
          </div>
        )}
      </AnimatePresence>

      {/* Embla Pagination Dots */}
      {scrollSnaps.length > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          {scrollSnaps.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollTo(idx)}
              className={`h-2.5 rounded-full transition-all cursor-pointer ${selectedIndex === idx
                  ? "bg-primary w-7 shadow-xs"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-2.5"
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
