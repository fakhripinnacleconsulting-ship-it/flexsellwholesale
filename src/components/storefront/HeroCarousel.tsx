"use client";

import * as React from "react";
import Image, { getImageProps } from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { m, LazyMotion, domAnimation, AnimatePresence } from "framer-motion";
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
  const [aspectRatios, setAspectRatios] = React.useState<Record<string, number>>({});
  const [isMobile, setIsMobile] = React.useState(false);

  // Monitor window resize to accurately track mobile vs desktop viewports
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleImageLoad = (idx: number, isMobileImg: boolean, e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight) {
      const key = `${idx}-${isMobileImg ? "mobile" : "desktop"}`;
      setAspectRatios((prev) => ({ ...prev, [key]: naturalWidth / naturalHeight }));
    }
  };

  const handleVideoMetadata = (idx: number, isMobileVideo: boolean, e: React.SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = e.currentTarget;
    if (videoWidth && videoHeight) {
      const key = `${idx}-${isMobileVideo ? "mobile" : "desktop"}`;
      setAspectRatios((prev) => ({ ...prev, [key]: videoWidth / videoHeight }));
    }
  };

  // Pre-load and measure intrinsic aspect ratios for both desktop and mobile slides on mount
  React.useEffect(() => {
    if (!slides || slides.length === 0) return;
    slides.forEach((slide, idx) => {
      // Measure Desktop Image / Poster
      const desktopUrl = slide.imageUrl || slide.posterUrl;
      if (desktopUrl) {
        const img = new window.Image();
        img.src = desktopUrl;
        const measureDesktop = () => {
          if (img.naturalWidth && img.naturalHeight) {
            setAspectRatios((prev) => ({ ...prev, [`${idx}-desktop`]: img.naturalWidth / img.naturalHeight }));
          }
        };
        if (img.complete) measureDesktop();
        else img.onload = measureDesktop;
      }

      // Measure Mobile Specific Image (if provided)
      if (slide.mobileImageUrl) {
        const mobImg = new window.Image();
        mobImg.src = slide.mobileImageUrl;
        const measureMobile = () => {
          if (mobImg.naturalWidth && mobImg.naturalHeight) {
            setAspectRatios((prev) => ({ ...prev, [`${idx}-mobile`]: mobImg.naturalWidth / mobImg.naturalHeight }));
          }
        };
        if (mobImg.complete) measureMobile();
        else mobImg.onload = measureMobile;
      }
    });
  }, [slides]);

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

  const hasMobileImg = isMobile && !!currentSlide?.mobileImageUrl;
  const activeKey = `${current}-${hasMobileImg ? "mobile" : "desktop"}`;
  const naturalRatio = aspectRatios[activeKey] || aspectRatios[`${current}-desktop` ];
  const fallbackRatio = isMobile ? (hasMobileImg ? 1.0 : 1.77) : 2.5;
  const activeRatio = naturalRatio || fallbackRatio;

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

  // Prepare Art Direction Image Props
  const hasMobileSpecificImg = !!currentSlide?.mobileImageUrl;
  const commonImgProps = {
    alt: currentSlide?.altText || "FlexSell Wholesale Banner",
    fill: true,
    priority: current === 0,
    sizes: "100vw",
    className: "object-contain w-full h-full",
  };

  // Generate desktop image props
  const { props: { srcSet: desktopSrcSet, src: dSrc, ...restDesktopProps } } = getImageProps({
    ...commonImgProps,
    src: fallbackImage,
  });

  // Generate mobile image props (fallback to desktop if none)
  const { props: { srcSet: mobileSrcSet } } = getImageProps({
    ...commonImgProps,
    src: hasMobileSpecificImg ? currentSlide.mobileImageUrl! : fallbackImage,
  });

  return (
    <section
      ref={sectionRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        aspectRatio: activeRatio ? `${activeRatio}` : undefined
      }}
      className="relative w-full overflow-hidden group select-none bg-background flex items-center justify-center transition-[aspect-ratio] duration-500 ease-in-out"
    >
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} custom={direction}>
          <m.div
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
          drag={slides.length > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, { offset, velocity }) => {
            if (slides.length <= 1) return;
            const swipe = Math.abs(offset.x) * velocity.x;
            if (swipe < -10000 || offset.x < -100) {
              nextSlide();
            } else if (swipe > 10000 || offset.x > 100) {
              prevSlide();
            }
          }}
          onClick={() => handleBannerClick(currentSlide.redirectUrl || "/products")}
          className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center"
        >
          {/* VIDEO BANNER SLIDE */}
          {isVideo ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
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
                onLoadedMetadata={(e) => handleVideoMetadata(current, false, e)}
                onError={() => setVideoError(true)}
                className={`w-full h-full object-contain transition-opacity duration-500 ${
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
                  onLoadedMetadata={(e) => handleVideoMetadata(current, true, e)}
                  onError={() => setVideoError(true)}
                  className="w-full h-full object-contain sm:hidden"
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
            /* IMAGE BANNER SLIDE (Native Picture Tag for Art Direction) */
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-10">
              <picture className="relative w-full h-full block">
                {hasMobileSpecificImg && (
                  <source media="(max-width: 639px)" srcSet={mobileSrcSet} />
                )}
                <source media="(min-width: 640px)" srcSet={desktopSrcSet} />
                <img 
                  src={dSrc} 
                  {...restDesktopProps}
                  fetchPriority={current === 0 ? "high" : "auto"}
                  onLoad={(e) => handleImageLoad(current, isMobile, e as any)} 
                />
              </picture>
            </div>
          )}

          {/* Dynamic Gradient & Glassmorphism Text Overlay */}
          {(currentSlide.overlayTitle || currentSlide.overlaySubtitle || currentSlide.ctaText) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end sm:items-center p-4 sm:p-12 md:p-16 z-20 pointer-events-none">
              <div className="max-w-2xl space-y-2 sm:space-y-3 pointer-events-auto">
                {currentSlide.overlayTitle && (
                  <h1 className="text-lg sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                    {currentSlide.overlayTitle}
                  </h1>
                )}
                {currentSlide.overlaySubtitle && (
                  <p className="text-[11px] sm:text-base md:text-lg text-white/90 font-medium line-clamp-2 drop-shadow">
                    {currentSlide.overlaySubtitle}
                  </p>
                )}
                {currentSlide.ctaText && (
                  <div className="pt-1 sm:pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBannerClick(currentSlide.redirectUrl || "/products");
                      }}
                      className="px-3.5 py-1.5 sm:px-6 sm:py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] sm:text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 flex items-center gap-1.5 sm:gap-2"
                    >
                      {currentSlide.ctaText} &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </m.div>
      </AnimatePresence>
      </LazyMotion>

      {/* Nav Arrow Controls (Only when > 1 slide) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 sm:p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-30 cursor-pointer hover:scale-110 border border-white/20"
            aria-label="Previous Slide"
          >
            <ChevronLeft className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 sm:p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all z-30 cursor-pointer hover:scale-110 border border-white/20"
            aria-label="Next Slide"
          >
            <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Bullet Indicators */}
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 z-30 bg-black/40 backdrop-blur-md px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full border border-white/10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(idx > current ? 1 : -1);
                  setCurrent(idx);
                }}
                className={`h-2 sm:h-2.5 rounded-full transition-all cursor-pointer ${
                  current === idx ? "bg-primary w-5 sm:w-6" : "bg-white/50 hover:bg-white w-2 sm:w-2.5"
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
