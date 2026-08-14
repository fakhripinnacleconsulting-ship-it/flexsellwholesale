"use client";

import * as React from "react";
import { Reorder } from "framer-motion";
import {
  GripVertical,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Images,
  LayoutGrid,
  MapPin,
  Save,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type {
  BannerSection,
  HomepageLayout,
  LayoutSection,
} from "../types";
import { createSectionId, getBuiltinMeta } from "@/lib/homepageLayout";

interface HomepageLayoutTabProps {
  layout: HomepageLayout;
  setLayout: React.Dispatch<React.SetStateAction<HomepageLayout>>;
  bannerSections: BannerSection[];
  setBannerSections: React.Dispatch<React.SetStateAction<BannerSection[]>>;
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onManageBanners: (sectionId: string) => void;
}

/**
 * The homepage's single ordering surface.
 *
 * Every section — built-in, custom banner, and the location block — appears in one list in
 * render order. Reordering is drag-and-drop, with an equivalent "Move after…" select so the
 * tab is usable from the keyboard (drag alone is not accessible, and gets fiddly past a
 * dozen rows).
 */
export function HomepageLayoutTab({
  layout,
  setLayout,
  bannerSections,
  setBannerSections,
  isSaving,
  onSave,
  onManageBanners,
}: HomepageLayoutTabProps) {
  const [newSectionName, setNewSectionName] = React.useState("");

  const bannerSectionById = React.useMemo(
    () => new Map(bannerSections.map((s) => [s.id, s])),
    [bannerSections]
  );

  const setSections = (sections: LayoutSection[]) => setLayout((prev) => ({ ...prev, sections }));

  const toggleVisibility = (id: string) => {
    setSections(
      layout.sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s))
    );
  };

  const moveAfter = (id: string, afterId: string) => {
    const current = [...layout.sections];
    const fromIdx = current.findIndex((s) => s.id === id);
    if (fromIdx === -1) return;
    const [moved] = current.splice(fromIdx, 1);

    if (afterId === "__start__") {
      current.unshift(moved);
    } else {
      const targetIdx = current.findIndex((s) => s.id === afterId);
      current.splice(targetIdx === -1 ? current.length : targetIdx + 1, 0, moved);
    }
    setSections(current);
  };

  const addBannerSection = () => {
    const name = newSectionName.trim() || `Banner Section ${bannerSections.length + 1}`;
    const id = createSectionId("bsec");

    const section: BannerSection = {
      id,
      name,
      displayMode: "carousel",
      autoplay: true,
      fullWidth: false,
      banners: [],
      isActive: true,
    };

    setBannerSections([...bannerSections, section]);
    // New sections start hidden: an empty band should never appear on the live homepage
    // just because someone created it. Add banners, then switch it on.
    setSections([
      ...layout.sections,
      { id: createSectionId("row"), kind: "banner", bannerSectionId: id, visible: false },
    ]);
    setNewSectionName("");
  };

  const deleteBannerSection = (rowId: string, bannerSectionId: string) => {
    // Remove BOTH the layout row and the section itself — leaving either behind produces
    // a dangling reference or an orphaned, unreachable section.
    setSections(layout.sections.filter((s) => s.id !== rowId));
    setBannerSections(bannerSections.filter((s) => s.id !== bannerSectionId));
  };

  const renameBannerSection = (bannerSectionId: string, name: string) => {
    setBannerSections(
      bannerSections.map((s) => (s.id === bannerSectionId ? { ...s, name } : s))
    );
  };

  const describe = (section: LayoutSection): { title: string; subtitle: string; icon: React.ReactNode; badge: string } => {
    if (section.kind === "builtin") {
      const meta = getBuiltinMeta(section.key);
      return {
        title: meta?.label || section.key,
        subtitle: meta?.description || "",
        icon: <LayoutGrid className="h-4 w-4 text-blue-500" />,
        badge: "Built-in",
      };
    }
    if (section.kind === "location") {
      return {
        title: "Location & Map",
        subtitle: "Address, contact details and map — usually last, just above the footer",
        icon: <MapPin className="h-4 w-4 text-rose-500" />,
        badge: "Location",
      };
    }
    const bs = bannerSectionById.get(section.bannerSectionId);
    return {
      title: bs?.name || "Missing banner section",
      subtitle: bs
        ? `${bs.banners.length} banner${bs.banners.length === 1 ? "" : "s"} · ${bs.displayMode}${bs.isActive ? "" : " · inactive"}`
        : "This section no longer exists — delete this row.",
      icon: <Images className="h-4 w-4 text-emerald-500" />,
      badge: "Banner",
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Homepage Section Order & Visibility
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Drag to reorder, or use &ldquo;Move after&rdquo;. Toggle the eye to show or hide a section on
            the live storefront.
          </p>
        </div>
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="font-bold text-xs gap-1.5 cursor-pointer shrink-0"
        >
          <Save className="h-4 w-4" /> Save Layout
        </Button>
      </div>

      {/* Add a banner section */}
      <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-xl border border-dashed border-border bg-muted/30">
        <Input
          value={newSectionName}
          onChange={(e) => setNewSectionName(e.target.value)}
          placeholder="New banner section name (e.g. Festive Offers)"
          className="text-xs flex-1"
          aria-label="New banner section name"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addBannerSection}
          className="font-bold text-xs gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Banner Section
        </Button>
      </div>

      <Reorder.Group axis="y" values={layout.sections} onReorder={setSections} className="space-y-2.5">
        {layout.sections.map((section) => {
          const { title, subtitle, icon, badge } = describe(section);
          const isBanner = section.kind === "banner";
          const bs = isBanner ? bannerSectionById.get(section.bannerSectionId) : undefined;

          return (
            <Reorder.Item
              key={section.id}
              value={section}
              className={`rounded-xl border bg-card p-3.5 transition-all cursor-grab active:cursor-grabbing ${
                section.visible ? "border-border" : "border-border/60 opacity-60"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <GripVertical className="h-5 w-5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
                  <span className="shrink-0">{icon}</span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-secondary text-muted-foreground border border-border shrink-0">
                        {badge}
                      </span>
                      {isBanner && bs ? (
                        <input
                          value={bs.name}
                          onChange={(e) => renameBannerSection(bs.id, e.target.value)}
                          className="font-bold text-xs text-foreground bg-transparent border-b border-dashed border-border/60 focus:border-primary focus:outline-none px-0.5 min-w-0"
                          aria-label={`Rename ${bs.name}`}
                        />
                      ) : (
                        <span className="font-bold text-xs text-foreground truncate">{title}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {/* Keyboard-operable equivalent of dragging. */}
                  <label className="sr-only" htmlFor={`move-${section.id}`}>
                    Move {title} after
                  </label>
                  <select
                    id={`move-${section.id}`}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) moveAfter(section.id, e.target.value);
                    }}
                    className="text-[11px] font-semibold rounded-lg border border-border bg-background px-2 py-1.5 cursor-pointer max-w-[9rem]"
                  >
                    <option value="">Move after…</option>
                    <option value="__start__">(Top of page)</option>
                    {layout.sections
                      .filter((s) => s.id !== section.id)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {describe(s).title}
                        </option>
                      ))}
                  </select>

                  {isBanner && bs && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onManageBanners(bs.id)}
                      className="text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Images className="h-3.5 w-3.5" /> Manage banners
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleVisibility(section.id)}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                    aria-pressed={section.visible}
                    aria-label={section.visible ? `Hide ${title}` : `Show ${title}`}
                    title={section.visible ? "Visible on storefront" : "Hidden from storefront"}
                  >
                    {section.visible ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {isBanner && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteBannerSection(section.id, section.bannerSectionId)}
                      className="text-destructive hover:bg-destructive/10 cursor-pointer"
                      aria-label={`Delete ${title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      <div className="flex justify-end pt-3 border-t">
        <Button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="font-bold text-xs gap-1.5 cursor-pointer px-6"
        >
          <Save className="h-4 w-4" /> Save Layout
        </Button>
      </div>
    </div>
  );
}
