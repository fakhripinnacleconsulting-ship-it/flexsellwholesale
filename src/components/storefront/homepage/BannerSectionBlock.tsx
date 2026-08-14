import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { resolveSectionRatios } from "@/lib/bannerAspectRatios";
import type { BannerSection } from "@/components/admin/cms/types";

interface BannerSectionBlockProps {
  section: BannerSection;
  /**
   * True only for the very first rendered section on the page. Controls whether this
   * block may claim LCP priority — a homepage with several banner sections must not
   * preload the first image of each one.
   */
  isFirstOnPage?: boolean;
}

/**
 * A custom, admin-created band of banners.
 *
 * Carousel mode reuses HeroCarousel outright, so mobile/desktop art direction, video
 * support, swipe, pause and the accessibility work all come for free. Grid mode renders
 * plain links with no JS carousel, which is cheaper and has no CLS risk.
 */
export function BannerSectionBlock({ section, isFirstOnPage = false }: BannerSectionBlockProps) {
  if (!section.isActive || !section.banners || section.banners.length === 0) return null;

  const containerClass = section.fullWidth
    ? "w-full"
    : "mx-auto max-w-8xl px-4 md:px-6 w-full";

  const hasHeader = !!(section.heading || section.subheading);
  // One ratio for the whole section — every banner is rendered into an identical box.
  const ratios = resolveSectionRatios(section);

  return (
    <section className={`${containerClass} py-2 sm:py-4`} aria-label={section.heading || section.name}>
      {hasHeader && (
        <div className="mb-5 sm:mb-6 border-b pb-4 border-border/60">
          {section.heading && (
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {section.heading}
            </h2>
          )}
          {section.subheading && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">{section.subheading}</p>
          )}
        </div>
      )}

      {section.displayMode === "grid" ? (
        <BannerGrid section={section} ratios={ratios} isFirstOnPage={isFirstOnPage && !hasHeader} />
      ) : (
        <div className={section.fullWidth ? "" : "overflow-hidden rounded-2xl"}>
          <HeroCarousel
            slides={section.banners}
            // Never a second <h1>: the hero owns that, every other section drops a level.
            // With a visible section heading (an <h2>), banner titles drop again to <h3>.
            headingLevel={hasHeader ? "h3" : "h2"}
            autoplay={section.autoplay !== false}
            eager={isFirstOnPage}
            // One box for every slide, so rotating between differently shaped images
            // cannot resize the section and push the rest of the page around.
            fixedAspectRatio={ratios}
            // Poster-style artwork must not be cropped; the section decides.
            objectFit={section.imageFit}
          />
        </div>
      )}
    </section>
  );
}

function BannerGrid({
  section,
  ratios,
  isFirstOnPage,
}: {
  section: BannerSection;
  ratios: { desktop: number; mobile: number };
  isFirstOnPage: boolean;
}) {
  const columns = section.gridColumns || 2;
  const columnClass =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : columns === 4
          ? "grid-cols-2 lg:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-2";

  return (
    <div className={`grid ${columnClass} gap-3 sm:gap-4 md:gap-6`}>
      {section.banners.map((banner, idx) => {
        const href = banner.redirectUrl || "/products";

        return (
          <Link
            key={`${banner.imageUrl}-${idx}`}
            href={href}
            // High-cardinality grid: prefetching every tile pulls a full RSC payload each.
            prefetch={false}
            // Every tile gets the section's ratio, not its own image's — otherwise a grid
            // of differently shaped uploads produces ragged rows of different heights.
            // Set as CSS vars because inline styles cannot carry a media query.
            className="group relative block overflow-hidden rounded-xl border border-border bg-secondary aspect-[var(--tile-ratio-mobile)] sm:aspect-[var(--tile-ratio-desktop)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={
              {
                "--tile-ratio-mobile": `${ratios.mobile}`,
                "--tile-ratio-desktop": `${ratios.desktop}`,
              } as React.CSSProperties
            }
          >
            {/* Art direction: a mobile image is used below 640px only when one was
                supplied; otherwise the desktop image serves both, matching the hero. */}
            <picture>
              {banner.mobileImageUrl && (
                <source media="(max-width: 639px)" srcSet={banner.mobileImageUrl} />
              )}
              <Image
                src={banner.imageUrl}
                alt={banner.altText || banner.overlayTitle || "Promotional banner"}
                fill
                sizes={columns >= 3 ? "(max-width: 640px) 100vw, 33vw" : "(max-width: 640px) 100vw, 50vw"}
                className={`${section.imageFit === "contain" ? "object-contain" : "object-cover"} transition-transform duration-500 group-hover:scale-105`}
                priority={isFirstOnPage && idx === 0}
              />
            </picture>

            {(banner.overlayTitle || banner.overlaySubtitle || banner.ctaText) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent flex items-end p-4 sm:p-6">
                <div className="space-y-1.5">
                  {banner.overlayTitle && (
                    <h3 className="text-base sm:text-2xl font-black text-white drop-shadow-md leading-tight">
                      {banner.overlayTitle}
                    </h3>
                  )}
                  {banner.overlaySubtitle && (
                    <p className="text-[11px] sm:text-sm text-white/90 font-medium line-clamp-2 drop-shadow">
                      {banner.overlaySubtitle}
                    </p>
                  )}
                  {banner.ctaText && (
                    <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-primary text-primary-foreground font-bold text-[11px] sm:text-sm rounded-lg shadow-lg">
                      {banner.ctaText} &rarr;
                    </span>
                  )}
                </div>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
