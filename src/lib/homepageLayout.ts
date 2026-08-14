import type {
  BuiltinSectionKey,
  HomepageLayout,
  HomepageVisibilityData,
  LayoutSection,
  BannerSection,
} from "@/components/admin/cms/types";

/**
 * Single source of truth for homepage section order and visibility.
 *
 * Both the storefront renderer and the CMS layout editor call `getEffectiveLayout()`, so
 * they can never disagree about what the page looks like.
 *
 * Backward compatibility is the whole point of this module: before this feature, order was
 * hardcoded in the homepage component and visibility lived in the `homepage_settings`
 * booleans. A store that has never opened the new Page Layout tab has no
 * `homepage_layout` document, and must still render byte-identically. So we *derive* a
 * layout from the historical order + those booleans, and only persist one when an admin
 * actually saves.
 */

/**
 * The historical hardcoded render order, with each section's matching visibility flag.
 *
 * Order here is load-bearing — it is what an un-migrated store gets. Do not reorder.
 */
const BUILTIN_ORDER: Array<{
  key: BuiltinSectionKey;
  /** The `homepage_settings` boolean that used to gate this section. */
  visibilityFlag: keyof HomepageVisibilityData;
  /** Admin-facing label shown in the Page Layout tab. */
  label: string;
  description: string;
}> = [
  { key: "hero", visibilityFlag: "showHeroBanners", label: "Top Hero Banner Slider", description: "Main top banner & video slider" },
  { key: "trustBar", visibilityFlag: "showTrustBar", label: "Trust Counter Bar", description: "Trust stats (items, orders shipped, etc.)" },
  { key: "categories", visibilityFlag: "showCategories", label: "Shop Categories Grid", description: "Top product category cards" },
  { key: "featuredCollections", visibilityFlag: "showFeaturedCollections", label: "Special Collections Grid", description: "Handpicked sourcing collection cards" },
  { key: "wholesaleBiz", visibilityFlag: "showWholesaleBiz", label: "Wholesale Business Highlights", description: "B2B direct factory rate features" },
  { key: "trendingProducts", visibilityFlag: "showTrendingProducts", label: "Fast Selling Products Grid", description: "Highest demand trending products" },
  { key: "newArrivals", visibilityFlag: "showNewArrivals", label: "Fresh Stock Grid", description: "Latest stock items added this week" },
  { key: "dropshipBiz", visibilityFlag: "showDropshipBiz", label: "Dropship Program Section", description: "Zero-inventory dropshipping features" },
  { key: "brandPartners", visibilityFlag: "showBrandPartners", label: "Brand Partners Bar", description: "Partner brand logos marquee" },
  { key: "recommendedProducts", visibilityFlag: "showRecommendedProducts", label: "Recommended Items Slider", description: "Recommended product slider" },
  { key: "testimonials", visibilityFlag: "showTestimonials", label: "Customer Reviews Block", description: "Retailer and buyer review cards" },
];

/** Metadata for rendering a built-in row in the CMS layout editor. */
export function getBuiltinMeta(key: BuiltinSectionKey) {
  return BUILTIN_ORDER.find((b) => b.key === key);
}

export function getBuiltinVisibilityFlag(key: BuiltinSectionKey): keyof HomepageVisibilityData | undefined {
  return getBuiltinMeta(key)?.visibilityFlag;
}

/** Stable-enough id for a newly created layout row or banner section. */
export function createSectionId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

/**
 * Builds the layout an un-migrated store implicitly has: historical order, visibility
 * taken from `homepage_settings`, plus the location section appended last (hidden by
 * default, so adding this feature does not change an existing homepage).
 */
export function deriveDefaultLayout(settings?: HomepageVisibilityData | null): HomepageLayout {
  const sections: LayoutSection[] = BUILTIN_ORDER.map((builtin) => ({
    id: `builtin_${builtin.key}`,
    kind: "builtin" as const,
    key: builtin.key,
    // The historical semantics: anything not explicitly false is visible.
    visible: settings?.[builtin.visibilityFlag] !== false,
  }));

  sections.push({
    id: "location_default",
    kind: "location",
    // Hidden by default: an existing homepage must not gain a section just because the
    // code shipped. The admin opts in from the Page Layout tab.
    visible: false,
  });

  return { version: 1, sections };
}

/**
 * Returns the layout to render/edit.
 *
 * - No stored layout  -> derive from the legacy visibility booleans.
 * - Stored layout     -> use it, but reconcile against BUILTIN_ORDER so that built-ins
 *                        added to the code after the layout was saved still appear
 *                        (appended, hidden, so they cannot silently alter a live page),
 *                        and built-ins removed from the code are dropped.
 *
 * Reconciliation matters because the stored document is a snapshot: without it, shipping a
 * new built-in section would make it permanently invisible to any store that had already
 * saved a layout.
 */
export function getEffectiveLayout(
  storedLayout?: HomepageLayout | null,
  settings?: HomepageVisibilityData | null
): HomepageLayout {
  if (!storedLayout || !Array.isArray(storedLayout.sections) || storedLayout.sections.length === 0) {
    return deriveDefaultLayout(settings);
  }

  const knownBuiltinKeys = new Set(BUILTIN_ORDER.map((b) => b.key));

  // Drop built-ins the code no longer defines; keep banner/location rows untouched.
  const reconciled: LayoutSection[] = storedLayout.sections.filter((section) => {
    if (section.kind === "builtin") return knownBuiltinKeys.has(section.key);
    return true;
  });

  const presentBuiltinKeys = new Set(
    reconciled.filter((s): s is Extract<LayoutSection, { kind: "builtin" }> => s.kind === "builtin").map((s) => s.key)
  );

  for (const builtin of BUILTIN_ORDER) {
    if (!presentBuiltinKeys.has(builtin.key)) {
      reconciled.push({
        id: `builtin_${builtin.key}`,
        kind: "builtin",
        key: builtin.key,
        visible: false,
      });
    }
  }

  const hasLocation = reconciled.some((s) => s.kind === "location");
  if (!hasLocation) {
    reconciled.push({ id: "location_default", kind: "location", visible: false });
  }

  return { version: 1, sections: reconciled };
}

/**
 * Drops layout rows that cannot render: hidden rows, and banner rows whose section is
 * missing or inactive. Called by the storefront so the renderer never has to null-check.
 */
export function getRenderableSections(
  layout: HomepageLayout,
  bannerSections: BannerSection[]
): LayoutSection[] {
  const byId = new Map(bannerSections.map((s) => [s.id, s]));

  return layout.sections.filter((section) => {
    if (!section.visible) return false;
    if (section.kind !== "banner") return true;

    const bannerSection = byId.get(section.bannerSectionId);
    // A dangling reference or an emptied section renders nothing — skip it rather than
    // leaving a blank gap in the page.
    return !!bannerSection && bannerSection.isActive && bannerSection.banners.length > 0;
  });
}

/**
 * Validates a layout before it is written, so we can never persist a layout that points at
 * a banner section that does not exist. Returns human-readable problems, empty when valid.
 */
export function validateLayout(layout: HomepageLayout, bannerSections: BannerSection[]): string[] {
  const problems: string[] = [];
  const ids = new Set(bannerSections.map((s) => s.id));
  const seenRowIds = new Set<string>();

  for (const section of layout.sections) {
    if (seenRowIds.has(section.id)) {
      problems.push(`Duplicate section id "${section.id}".`);
    }
    seenRowIds.add(section.id);

    if (section.kind === "banner" && !ids.has(section.bannerSectionId)) {
      problems.push(`Layout references a banner section that no longer exists (${section.bannerSectionId}).`);
    }
  }

  return problems;
}

/**
 * Writes visibility back into the layout for a built-in section. Used by the legacy
 * Section Visibility tab so there is exactly one writer of visibility state.
 */
export function setBuiltinVisibility(
  layout: HomepageLayout,
  key: BuiltinSectionKey,
  visible: boolean
): HomepageLayout {
  return {
    ...layout,
    sections: layout.sections.map((section) =>
      section.kind === "builtin" && section.key === key ? { ...section, visible } : section
    ),
  };
}

/** Projects a layout back onto the legacy boolean shape, so both stay consistent. */
export function layoutToVisibilitySettings(
  layout: HomepageLayout,
  existing?: HomepageVisibilityData | null
): HomepageVisibilityData {
  const next: HomepageVisibilityData = { ...(existing || {}) };
  for (const section of layout.sections) {
    if (section.kind !== "builtin") continue;
    const flag = getBuiltinVisibilityFlag(section.key);
    if (flag) next[flag] = section.visible;
  }
  return next;
}

export { BUILTIN_ORDER };
