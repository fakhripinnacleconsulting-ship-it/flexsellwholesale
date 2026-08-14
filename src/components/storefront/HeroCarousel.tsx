"use client";

import * as React from "react";
import Image, { getImageProps } from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Volume2, VolumeX, Pause, Play } from "lucide-react";
import { m, LazyMotion, domAnimation, AnimatePresence } from "framer-motion";
import { BannerSlide } from "@/components/admin/cms/types";
import { mergeAspectRatio } from "@/lib/aspectRatioState";

interface HeroCarouselProps {
  slides: BannerSlide[];
  /**
   * Heading tag for a slide's overlay title.
   *
   * The hero is the page's <h1>. Every other banner section must drop to <h2> — multiple
   * <h1>s on one page is an accessibility violation and an SEO smell, and becomes possible
   * as soon as an admin adds a second banner section.
   */
  headingLevel?: "h1" | "h2" | "h3";
  /**
   * CMS preview mode: no navigation on click, no autoplay, no LCP priority.
   * Editing a banner should never navigate the admin away from the editor.
   */
  previewMode?: boolean;
  /** Carousel autoplay. Ignored in preview mode and under prefers-reduced-motion. */
  autoplay?: boolean;
  /**
   * Whether this carousel may claim LCP priority. Only the first banner of the first
   * section on the page should; everything else stays lazy.
   */
  eager?: boolean;
  /**
   * Locks the container to one ratio for every slide.
   *
   * Without it the carousel measures each slide's natural dimensions and resizes to match,
   * so a section holding differently shaped images visibly grows and shrinks as it rotates,
   * pushing the rest of the page around. With it the box is reserved once and images are
   * cropped to fill (object-cover instead of object-contain).
   *
   * The hero omits this deliberately: it is a single full-bleed band at the top of the page
   * where letterboxing the whole image matters more than a stable height.
   */
  fixedAspectRatio?: { desktop: number; mobile: number };
  /**
   * Forces which upload is shown, ignoring the viewport.
   *
   * The CMS preview simulates a phone by narrowing a container, but `<picture>` media
   * queries resolve against the *viewport*, not the container — so on an admin's desktop
   * the "Mobile" toggle still rendered the desktop image and there was no way to check a
   * mobile banner before publishing it.
   */
  forceViewport?: "desktop" | "mobile";
  /**
   * Overrides how images fill a fixed box. Without it a fixed ratio always crops, which
   * destroys poster-style artwork whose text sits near the edges.
   */
  objectFit?: "cover" | "contain";
}

export function HeroCarousel({
  slides,
  headingLevel = "h1",
  previewMode = false,
  autoplay = true,
  eager = true,
  fixedAspectRatio,
  forceViewport,
  objectFit,
}: HeroCarouselProps) {
  const router = useRouter();
  const [current, setCurrent] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  /** User-controlled pause. WCAG 2.2.2 requires a way to stop auto-updating content. */
  const [isPaused, setIsPaused] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  const HeadingTag = headingLevel;

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const autoplayEnabled = autoplay && !previewMode && !prefersReducedMotion && !isPaused;

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
  const [isMounted, setIsMounted] = React.useState(false);

  // Monitor window resize to accurately track mobile vs desktop viewports
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    setIsMounted(true);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleImageLoad = (idx: number, el: HTMLImageElement) => {
    // With a fixed container ratio these measurements are never read, so taking them
    // would only churn state — and churning state is what makes the feedback loop
    // described in the preload effect possible in the first place.
    if (fixedAspectRatio) return;
    const { naturalWidth, naturalHeight } = el;
    if (naturalWidth && naturalHeight) {
      const isMob = typeof window !== "undefined" && window.innerWidth < 640;
      const hasMobImg = isMob && !!slides[idx]?.mobileImageUrl;
      const key = `${idx}-${hasMobImg ? "mobile" : "desktop"}`;
      const newRatio = naturalWidth / naturalHeight;
      setAspectRatios((prev) => mergeAspectRatio(prev, key, newRatio));
    }
  };

  // Latest handleImageLoad without making it a ref dependency — keeps the ref callback
  // stable across renders while still calling current logic.
  const handleImageLoadRef = React.useRef(handleImageLoad);
  handleImageLoadRef.current = handleImageLoad;

  /**
   * Measures an already-cached image once it is attached.
   *
   * Memoised on `current` so React only invokes it when the slide actually changes,
   * rather than on every commit as an inline arrow would.
   */
  const measuredImageRef = React.useCallback(
    (el: HTMLImageElement | null) => {
      if (fixedAspectRatio) return;
      if (el && el.complete && el.naturalWidth) {
        handleImageLoadRef.current(current, el);
      }
    },
    [current, fixedAspectRatio]
  );

  const handleVideoMetadata = (idx: number, isMobileVideo: boolean, e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (fixedAspectRatio) return;
    const { videoWidth, videoHeight } = e.currentTarget;
    if (videoWidth && videoHeight) {
      const key = `${idx}-${isMobileVideo ? "mobile" : "desktop"}`;
      const newRatio = videoWidth / videoHeight;
      setAspectRatios((prev) => mergeAspectRatio(prev, key, newRatio));
    }
  };

  // Pre-load and measure intrinsic aspect ratios for both desktop and mobile slides on mount
  React.useEffect(() => {
    // With a fixed ratio the measurements are never read, and this effect would otherwise
    // download every slide (desktop *and* mobile) up front purely to inspect its
    // dimensions — exactly the eager loading the rest of this work removes.
    if (fixedAspectRatio) return;
    if (!slides || slides.length === 0) return;
    slides.forEach((slide, idx) => {
      // Measure Desktop Image / Poster
      const desktopUrl = slide.imageUrl || slide.posterUrl;
      if (desktopUrl) {
        const img = new window.Image();
        img.src = desktopUrl;
        const measureDesktop = () => {
          if (img.naturalWidth && img.naturalHeight) {
            const key = `${idx}-desktop`;
            const newRatio = img.naturalWidth / img.naturalHeight;
            // Bail out when unchanged. Without this the state object is replaced on every
            // measurement, and because the measured ratio drives the container height it
            // can feed back into itself: height changes -> page scrollbar toggles ->
            // viewport width crosses the 640px <source> breakpoint -> a different image is
            // selected -> a different ratio is measured -> repeat, until React throws
            // "Maximum update depth exceeded" (#185).
            setAspectRatios((prev) => mergeAspectRatio(prev, key, newRatio));
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
            const key = `${idx}-mobile`;
            const newRatio = mobImg.naturalWidth / mobImg.naturalHeight;
            // Same bail-out as the desktop branch above — see the note there.
            setAspectRatios((prev) => mergeAspectRatio(prev, key, newRatio));
          }
        };
        if (mobImg.complete) measureMobile();
        else mobImg.onload = measureMobile;
      }
    });
  }, [slides, fixedAspectRatio]);

  // Reset video error state when current slide changes
  React.useEffect(() => {
    setVideoError(false);
  }, [current]);

  // Auto-slide Timer (Autoplay when visible in UI, pause on hover)
  React.useEffect(() => {
    if (!autoplayEnabled) return;
    if (!slides || slides.length <= 1 || isHovered || !isIntersecting || !isTabVisible) return;
    const timer = setInterval(() => {
      setDirection(1);
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides, isHovered, isIntersecting, isTabVisible, autoplayEnabled]);

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
    // In the CMS preview the admin is editing this banner — navigating away would lose
    // their work and is never what they meant by clicking it.
    if (previewMode) return;
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

  // `forceViewport` lets the CMS preview simulate a phone on a desktop screen; live
  // rendering always follows the real viewport.
  const treatAsMobile = forceViewport ? forceViewport === "mobile" : isMobile;
  const hasMobileImg = treatAsMobile && !!currentSlide?.mobileImageUrl;
  const activeKey = `${current}-${hasMobileImg ? "mobile" : "desktop"}`;
  const naturalRatio = aspectRatios[activeKey];
  // An admin-supplied ratio lets the very first paint reserve the right box, instead of
  // measuring after load and animating aspect-ratio into place (a visible CLS hit).
  const authoredRatio = hasMobileImg ? currentSlide?.mobileAspectRatio : currentSlide?.aspectRatio;
  const fallbackRatio = treatAsMobile ? (hasMobileImg ? 1.0 : 1.77) : 2.5;

  // A section-level fixed ratio wins over everything: the whole point is that the box
  // never changes between slides, so per-slide measurements must not feed into it.
  const isFixed = !!fixedAspectRatio;
  const activeRatio = isFixed
    ? (treatAsMobile ? fixedAspectRatio!.mobile : fixedAspectRatio!.desktop)
    : (authoredRatio || naturalRatio || fallbackRatio);

  // Fixed box => crop to fill. Free box => letterbox, since the container already matches
  // the image's own shape.
  // Written as literals, not `object-${objectFit}` — Tailwind's scanner only picks up
  // complete class names, so an interpolated one would never be generated.
  const imageFitClass =
    objectFit === "contain" ? "object-contain"
      : objectFit === "cover" ? "object-cover"
        : isFixed ? "object-cover" : "object-contain";

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
  // Only an eager, non-preview carousel may claim LCP priority. A page with several
  // banner sections must not preload the first image of every one of them.
  const claimsPriority = eager && !previewMode && current === 0;

  const commonImgProps = {
    alt: currentSlide?.altText || "FlexSell Wholesale Banner",
    fill: true,
    priority: claimsPriority,
    sizes: "100vw",
    className: `${imageFitClass} w-full h-full`,
  };

  // Generate desktop image props
  const { props: { srcSet: desktopSrcSet, src: dSrc, ...restDesktopProps } } = getImageProps({
    ...commonImgProps,
    src: fallbackImage,
  });

  // Generate mobile image props (fallback to desktop if none)
  const mobileSrc = hasMobileSpecificImg ? currentSlide.mobileImageUrl! : fallbackImage;

  const { props: { srcSet: mobileSrcSet } } = getImageProps({
    ...commonImgProps,
    src: mobileSrc,
  });

  return (
    <section
      ref={sectionRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        aspectRatio: activeRatio ? `${activeRatio}` : undefined
      }}
      // No aspect-ratio transition when the box is fixed — there is nothing to animate
      // between, and the transition is precisely the layout shift we are removing.
      className={`relative w-full overflow-hidden group select-none bg-background flex items-center justify-center${
        isFixed ? "" : " transition-[aspect-ratio] duration-500 ease-in-out"
      }`}
      aria-roledescription="carousel"
      aria-label={slides.length > 1 ? `Promotional banners, ${slides.length} slides` : "Promotional banner"}
    >
      {/* Announces slide changes to screen readers, which otherwise get no signal that
          the visible content was swapped underneath them. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {slides.length > 1 ? `Slide ${current + 1} of ${slides.length}: ${currentSlide?.altText || currentSlide?.overlayTitle || "Banner"}` : ""}
      </div>

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
          drag={isMounted && slides.length > 1 ? "x" : false}
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
          aria-roledescription="slide"
          aria-label={`Slide ${current + 1} of ${slides.length}`}
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
                className={`w-full h-full ${imageFitClass} transition-opacity duration-500 ${
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
                  className={`w-full h-full ${imageFitClass} sm:hidden`}
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
              {/*
                Art direction between the mobile and desktop uploads.

                The `?? raw URL` fallbacks are load-bearing, not defensive noise: with
                `images.unoptimized` enabled (which this project sets), getImageProps
                returns `srcSet: undefined`. A <source> without a srcset contributes
                nothing, so BOTH sources were being skipped and every viewport fell
                through to the <img> below — which carries the desktop image. That is why
                a separately uploaded mobile banner never appeared on phones, and why the
                wide desktop image looked wrong cropped into the mobile aspect box.
              */}
              <picture className="relative w-full h-full block">
                {/* When a viewport is forced (CMS preview), the media queries would still
                    resolve against the real window, so the sources are omitted entirely
                    and the chosen upload is put directly on the <img>. */}
                {!forceViewport && hasMobileSpecificImg && (
                  <source media="(max-width: 639px)" srcSet={mobileSrcSet ?? mobileSrc} />
                )}
                {!forceViewport && (
                  <source media="(min-width: 640px)" srcSet={desktopSrcSet ?? fallbackImage} />
                )}
                <img
                  src={forceViewport && hasMobileImg ? mobileSrc : dSrc}
                  {...restDesktopProps}
                  fetchPriority={claimsPriority ? "high" : "auto"}
                  // Stable ref: an inline arrow is a new function every render, so React
                  // detaches and re-attaches it on each commit — re-measuring, and
                  // re-entering the state churn above, on every single re-render.
                  ref={measuredImageRef}
                  onLoad={(e) => handleImageLoad(current, e.currentTarget)} 
                />
              </picture>
            </div>
          )}

          {/* Dynamic Gradient & Glassmorphism Text Overlay */}
          {(currentSlide.overlayTitle || currentSlide.overlaySubtitle || currentSlide.ctaText) && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-end sm:items-center p-4 sm:p-12 md:p-16 z-20 pointer-events-none">
              <div className="max-w-2xl space-y-2 sm:space-y-3 pointer-events-auto">
                {currentSlide.overlayTitle && (
                  <HeadingTag className="text-lg sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-md leading-tight">
                    {currentSlide.overlayTitle}
                  </HeadingTag>
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

      {/* Keyboard-reachable link to the current slide's destination.
          The slide itself is a <div> (framer-motion drag target), which is not focusable
          and cannot be actioned from the keyboard. This gives keyboard and screen-reader
          users the same destination, and gives crawlers a real <a href>. */}
      {!previewMode && currentSlide?.redirectUrl && (
        <a
          href={currentSlide.redirectUrl}
          className="absolute left-4 bottom-4 z-40 px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-bold border border-white/20 opacity-0 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white pointer-events-none focus-visible:pointer-events-auto"
        >
          Go to {currentSlide.overlayTitle || currentSlide.altText || "banner destination"}
        </a>
      )}

      {/* Nav Arrow Controls (Only when > 1 slide) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 sm:p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all z-30 cursor-pointer hover:scale-110 border border-white/20"
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
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white p-2 sm:p-2.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all z-30 cursor-pointer hover:scale-110 border border-white/20"
            aria-label="Next Slide"
          >
            <ChevronRight className="h-4 w-4 sm:h-6 sm:w-6" />
          </button>

          {/* Slide indicators, plus the rotation pause control.
              The pause control lives here rather than in its own corner: sitting opposite
              the video mute button it read as a video play/pause, when it actually stops
              the slideshow — and it applies to image slides just as much as video ones.
              Grouping it with the dots makes it unmistakably a carousel control. */}
          <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 z-30">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDirection(idx > current ? 1 : -1);
                  setCurrent(idx);
                }}
                // drop-shadow replaces the removed dark pill: without a backdrop the dots
                // would disappear against a light banner.
                className={`h-2 sm:h-2.5 rounded-full transition-all cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] ${
                  current === idx ? "bg-primary w-5 sm:w-6" : "bg-white/70 hover:bg-white w-2 sm:w-2.5"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}

            {/* WCAG 2.2.2: content that auto-updates for more than 5s needs a way to stop
                it. Hidden when autoplay is already off, so it never appears as a dead
                control on a static banner. */}
            {autoplay && !previewMode && !prefersReducedMotion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaused((p) => !p);
                }}
                className="ml-1 text-white/80 hover:text-white transition-colors cursor-pointer drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={isPaused ? "Resume banner rotation" : "Pause banner rotation"}
              >
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
