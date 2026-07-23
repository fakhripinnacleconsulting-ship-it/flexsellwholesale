"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BannerSlide } from "@/components/admin/cms/types";

interface HeroCarouselProps {
  slides: BannerSlide[];
}

export function HeroCarousel({ slides }: HeroCarouselProps) {
  const router = useRouter();
  const [current, setCurrent] = React.useState(0);
  const [direction, setDirection] = React.useState(1);

  // Performance Controls: Video Element & Viewport Observers
  const sectionRef = React.useRef<HTMLElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isIntersecting, setIsIntersecting] = React.useState(true);
  const [isTabVisible, setIsTabVisible] = React.useState(true);
  const [isMuted, setIsMuted] = React.useState(true);
  const [isHovered, setIsHovered] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);

  // Reset video error state when current slide changes
  React.useEffect(() => {
    setVideoError(false);
  }, [current]);

  // Auto-slide Timer (Autoplay when visible in UI, pause on hover)
  React.useEffect(() => {
    if (!slides || slides.length <= 1 || isHovered || !isIntersecting || !isTabVisible) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides, isHovered, isIntersecting, isTabVisible]);

  // Viewport IntersectionObserver to pause video when off-screen
  React.useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersecting(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Handle Tab Visibility (pause video when tab is in background)
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Control Video Playback depending on visibility, tab focus & current slide
  React.useEffect(() => {
    const activeSlide = slides?.[current];
    const isVideoSlide = activeSlide?.mediaType === "video" || !!activeSlide?.videoUrl;

    if (!isVideoSlide || !videoRef.current || videoError) return;

    if (isIntersecting && isTabVisible) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay policy or media format error; handled via fallback
        });
      }
    } else {
      videoRef.current.pause();
    }
  }, [current, isIntersecting, isTabVisible, videoError, slides]);

  if (!slides || slides.length === 0) return null;

  const nextSlide = () => {
    setDirection(1);
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setDirection(-1);
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleBannerClick = (url: string) => {
    if (!url) return;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.location.href = url;
    } else {
      router.push(url);
    }
  };

  const currentSlide = slides[current];
  const isVideo = (currentSlide?.mediaType === "video" || !!currentSlide?.videoUrl) && !videoError;
  const fallbackImage = currentSlide?.posterUrl || currentSlide?.imageUrl || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80";

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      x: dir < 0 ? "100%" : "-100%",
      opacity: 0
    })
  };

  return (
    <section
      ref={sectionRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative w-full h-[280px] sm:h-[380px] md:h-[480px] lg:h-[560px] 2xl:h-[640px] bg-black overflow-hidden group select-none"
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={current}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.3 }
          }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, { offset, velocity }) => {
            const swipe = Math.abs(offset.x) * velocity.x;
            if (swipe < -10000 || offset.x < -100) {
              nextSlide();
            } else if (swipe > 10000 || offset.x > 100) {
              prevSlide();
            }
          }}
          onClick={() => handleBannerClick(currentSlide.redirectUrl || "/products")}
          className="absolute inset-0 w-full h-full cursor-pointer"
        >
          {/* VIDEO BANNER SLIDE */}
          {isVideo ? (
            <div className="relative w-full h-full bg-black">
              {/* Desktop / Main Video */}
              <video
                key={currentSlide.videoUrl}
                ref={videoRef}
                src={currentSlide.videoUrl}
                poster={currentSlide.posterUrl || currentSlide.imageUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                preload="auto"
                onError={() => setVideoError(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${
                  currentSlide.mobileVideoUrl ? "hidden sm:block" : "block"
                }`}
              />

              {/* Mobile Specific Video (if defined) */}
              {currentSlide.mobileVideoUrl && (
                <video
                  key={currentSlide.mobileVideoUrl}
                  src={currentSlide.mobileVideoUrl}
                  poster={currentSlide.posterUrl || currentSlide.mobileImageUrl || currentSlide.imageUrl}
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                  preload="auto"
                  onError={() => setVideoError(true)}
                  className="w-full h-full object-cover sm:hidden"
                />
              )}

              {/* Mute/Unmute Toggle button for Video */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md transition-all border border-white/20"
                title={isMuted ? "Unmute Video" : "Mute Video"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            /* IMAGE BANNER SLIDE (or Fallback if Video Error) */
            <>
              {/* Desktop Banner Image */}
              <div className={`relative w-full h-full ${currentSlide.mobileImageUrl ? "hidden sm:block" : "block"}`}>
                <Image
                  src={fallbackImage}
                  alt={currentSlide.altText || "FlexSell Wholesale Banner"}
                  fill
                  priority={current === 0}
                  className="object-cover"
                  sizes="100vw"
                />
              </div>

              {/* Mobile Specific Image if available */}
              {currentSlide.mobileImageUrl && (
                <div className="relative w-full h-full block sm:hidden">
                  <Image
                    src={currentSlide.mobileImageUrl}
                    alt={currentSlide.altText || "FlexSell Wholesale Banner"}
                    fill
                    priority={current === 0}
                    className="object-cover"
                    sizes="100vw"
                  />
                </div>
              )}
            </>
          )}

          {/* Dynamic Gradient & Glassmorphism Text Overlay */}
          {(currentSlide.overlayTitle || currentSlide.overlaySubtitle || currentSlide.ctaText) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end sm:items-center p-6 sm:p-12 md:p-16 z-10 pointer-events-none">
              <div className="max-w-2xl space-y-3 pointer-events-auto">
                {currentSlide.overlayTitle && (
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                    {currentSlide.overlayTitle}
                  </h1>
                )}
                {currentSlide.overlaySubtitle && (
                  <p className="text-xs sm:text-base md:text-lg text-white/90 font-medium line-clamp-2 drop-shadow">
                    {currentSlide.overlaySubtitle}
                  </p>
                )}
                {currentSlide.ctaText && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBannerClick(currentSlide.redirectUrl || "/products");
                      }}
                      className="px-5 py-2.5 sm:px-6 sm:py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs sm:text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-2"
                    >
                      {currentSlide.ctaText} &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Nav Arrow Controls */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer hover:scale-110 border border-white/20"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-20 cursor-pointer hover:scale-110 border border-white/20"
            aria-label="Next Slide"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Bullet Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(idx > current ? 1 : -1);
                  setCurrent(idx);
                }}
                className={`h-2.5 rounded-full transition-all cursor-pointer ${
                  current === idx ? "bg-primary w-6" : "bg-white/50 hover:bg-white w-2.5"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
