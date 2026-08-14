"use client";

import * as React from "react";
import { ArrowLeft, Monitor, Smartphone, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BannersTab } from "./BannersTab";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import {
  DESKTOP_ASPECT_PRESETS,
  MOBILE_ASPECT_PRESETS,
  DEFAULT_DESKTOP_RATIO,
  DEFAULT_MOBILE_RATIO,
  resolveSectionRatios,
  ratioDeviation,
  RATIO_TOLERANCE,
  getPreset,
} from "@/lib/bannerAspectRatios";
import type { BannerSection, BannerSlide } from "../types";

interface BannerSectionEditorProps {
  section: BannerSection;
  onChange: (section: BannerSection) => void;
  onBack: () => void;
  onAddBanner: () => void;
  onViewBanner: (banner: BannerSlide) => void;
  onEditBanner: (idx: number, banner: BannerSlide) => void;
  onDeleteBanner: (idx: number) => void;
}

/**
 * Edits one banner section: its display settings, its banners, and a live preview.
 *
 * The banner list is `BannersTab` — the same component the hero uses — so reordering and
 * the row layout stay identical across both. The preview is the real `HeroCarousel` in
 * `previewMode`, so what the admin sees is what the storefront renders, minus navigation.
 */
export function BannerSectionEditor({
  section,
  onChange,
  onBack,
  onAddBanner,
  onViewBanner,
  onEditBanner,
  onDeleteBanner,
}: BannerSectionEditorProps) {
  const [previewViewport, setPreviewViewport] = React.useState<"desktop" | "mobile">("desktop");

  const update = (patch: Partial<BannerSection>) => onChange({ ...section, ...patch });

  const bannersMissingAlt = section.banners.filter((b) => !b.altText?.trim()).length;
  const ratios = resolveSectionRatios(section);

  // Flag uploads whose shape is far enough from the section ratio that object-cover will
  // crop something the admin probably meant to keep. Measured in the browser from the
  // actual file, so it catches mistakes the URL alone cannot reveal.
  const [offRatioCount, setOffRatioCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    const urls = section.banners.map((b) => b.imageUrl).filter(Boolean);
    if (urls.length === 0) {
      setOffRatioCount(0);
      return;
    }

    Promise.all(
      urls.map(
        (url) =>
          new Promise<number | null>((resolve) => {
            const img = new window.Image();
            img.onload = () =>
              resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null);
            img.onerror = () => resolve(null);
            img.src = url;
          })
      )
    ).then((measured) => {
      if (cancelled) return;
      setOffRatioCount(
        measured.filter((r) => r !== null && ratioDeviation(r, ratios.desktop) > RATIO_TOLERANCE).length
      );
    });

    return () => {
      cancelled = true;
    };
  }, [section.banners, ratios.desktop]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onBack}
            className="gap-1.5 text-xs font-bold cursor-pointer shrink-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back to layout
          </Button>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate">{section.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {section.banners.length} banner{section.banners.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={onAddBanner}
          className="font-bold text-xs gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Banner
        </Button>
      </div>

      {/* Section display settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-border bg-muted/30">
        <div className="space-y-1.5">
          <label htmlFor="bs-heading" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Section Heading (optional)
          </label>
          <Input
            id="bs-heading"
            value={section.heading || ""}
            onChange={(e) => update({ heading: e.target.value })}
            placeholder="e.g. Festive Offers"
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bs-subheading" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Subheading (optional)
          </label>
          <Input
            id="bs-subheading"
            value={section.subheading || ""}
            onChange={(e) => update({ subheading: e.target.value })}
            placeholder="Short supporting line"
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bs-mode" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Display Mode
          </label>
          <select
            id="bs-mode"
            value={section.displayMode}
            onChange={(e) => update({ displayMode: e.target.value as BannerSection["displayMode"] })}
            className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-3 py-2 cursor-pointer"
          >
            <option value="carousel">Carousel (rotating)</option>
            <option value="grid">Grid (all visible)</option>
          </select>
        </div>

        {section.displayMode === "grid" ? (
          <div className="space-y-1.5">
            <label htmlFor="bs-cols" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Grid Columns
            </label>
            <select
              id="bs-cols"
              value={section.gridColumns || 2}
              onChange={(e) => update({ gridColumns: Number(e.target.value) as BannerSection["gridColumns"] })}
              className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-3 py-2 cursor-pointer"
            >
              <option value={1}>1 column</option>
              <option value={2}>2 columns</option>
              <option value={3}>3 columns</option>
              <option value={4}>4 columns</option>
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Carousel Autoplay
            </span>
            <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer py-2">
              <input
                type="checkbox"
                checked={section.autoplay !== false}
                onChange={(e) => update({ autoplay: e.target.checked })}
                className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
              />
              Rotate automatically
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Width
          </span>
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer py-2">
            <input
              type="checkbox"
              checked={!!section.fullWidth}
              onChange={(e) => update({ fullWidth: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
            />
            Full-bleed (edge to edge)
          </label>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bs-ratio" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Desktop Image Ratio
          </label>
          <select
            id="bs-ratio"
            value={section.aspectRatio || DEFAULT_DESKTOP_RATIO}
            onChange={(e) => update({ aspectRatio: e.target.value })}
            className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-3 py-2 cursor-pointer"
          >
            {DESKTOP_ASPECT_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} — {p.recommended}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="bs-ratio-mobile" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Mobile Image Ratio
          </label>
          <select
            id="bs-ratio-mobile"
            value={section.mobileAspectRatio || DEFAULT_MOBILE_RATIO}
            onChange={(e) => update({ mobileAspectRatio: e.target.value })}
            className="w-full text-xs font-semibold rounded-lg border border-border bg-background px-3 py-2 cursor-pointer"
          >
            {MOBILE_ASPECT_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label} — {p.recommended}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Section Status
          </span>
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer py-2">
            <input
              type="checkbox"
              checked={section.isActive}
              onChange={(e) => update({ isActive: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
            />
            Active
          </label>
        </div>
      </div>

      {offRatioCount > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-semibold">
            {offRatioCount} image{offRatioCount === 1 ? " does" : "s do"} not match this section&rsquo;s{" "}
            {section.aspectRatio || DEFAULT_DESKTOP_RATIO} ratio and will be cropped to fit. Upload at{" "}
            {getPreset(section.aspectRatio || DEFAULT_DESKTOP_RATIO, DESKTOP_ASPECT_PRESETS)?.recommended}{" "}
            to control exactly what stays visible. Check the preview below.
          </p>
        </div>
      )}

      {bannersMissingAlt > 0 && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-semibold">
            {bannersMissingAlt} banner{bannersMissingAlt === 1 ? " has" : "s have"} no alt text. Screen
            readers and search engines cannot describe them — add a short description of what each
            image shows.
          </p>
        </div>
      )}

      {/* Live preview */}
      {section.banners.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Live Preview</h4>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setPreviewViewport("desktop")}
                aria-pressed={previewViewport === "desktop"}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewViewport === "desktop" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" /> Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport("mobile")}
                aria-pressed={previewViewport === "mobile"}
                className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                  previewViewport === "mobile" ? "bg-background text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Mobile
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/20 p-4 overflow-hidden">
            <div
              className="mx-auto overflow-hidden rounded-lg border border-border bg-background transition-[max-width] duration-300"
              style={{ maxWidth: previewViewport === "mobile" ? "380px" : "100%" }}
            >
              {/* The real storefront component. previewMode stops it navigating away from
                  the editor and stops it claiming LCP priority inside the admin panel. */}
              <HeroCarousel
                slides={section.banners}
                previewMode
                eager={false}
                headingLevel="h3"
                autoplay={false}
                // Same fixed box the storefront uses, so the preview shows the real crop
                // rather than each image at its own natural shape.
                fixedAspectRatio={ratios}
                // The toggle only narrows a container; <picture> media queries still see
                // the admin's desktop viewport. Without this, switching to Mobile kept
                // showing the desktop upload and a mobile banner could not be checked.
                forceViewport={previewViewport}
              />
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              {previewViewport === "mobile"
                ? "Showing the mobile upload where one exists; banners without it fall back to the desktop image, exactly as on the live site."
                : "Showing the desktop upload. Clicks are disabled while editing."}
            </p>
          </div>
        </div>
      )}

      {/* Banner list — same component the hero banners use */}
      {section.banners.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
          <p className="text-sm font-semibold text-foreground">No banners yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first banner to see it previewed here.
          </p>
        </div>
      ) : (
        <BannersTab
          banners={section.banners}
          onView={onViewBanner}
          onEdit={onEditBanner}
          onDelete={onDeleteBanner}
          onReorder={(banners) => update({ banners })}
        />
      )}
    </div>
  );
}
