export interface BannerSlide {
  mediaType?: "image" | "video";
  imageUrl: string;
  /**
   * Optional. When absent the desktop `imageUrl` is used on mobile too — the carousel
   * only emits a `<source media="(max-width: 639px)">` when this is set.
   */
  mobileImageUrl?: string;
  videoUrl?: string;
  mobileVideoUrl?: string;
  posterUrl?: string;
  redirectUrl: string;
  altText?: string;
  overlayTitle?: string;
  overlaySubtitle?: string;
  ctaText?: string;
  /**
   * Intrinsic width/height of the desktop asset, e.g. 2.5 for a 2000x800 banner.
   *
   * Stored so the first paint can reserve the correct box. Without it the carousel
   * measures the natural ratio after load and animates `aspect-ratio` into place,
   * which is a visible layout shift and a CLS penalty.
   */
  aspectRatio?: number;
  /** Same, for the mobile asset when one is supplied. */
  mobileAspectRatio?: number;
}

export interface TrustStatItem {
  icon: string;
  count: string;
  label: string;
}

export interface BusinessCardItem {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
}

export interface BusinessSectionData {
  heading: string;
  subheading: string;
  cards: BusinessCardItem[];
  ctaText: string;
  ctaLink: string;
}

export interface TestimonialItem {
  name: string;
  business: string;
  roleBadge?: string;
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

export interface BrandPartner {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  category?: string;
}

export interface BlogPostItem {
  id?: string;
  title: string;
  slug: string;
  author?: string;
  category?: string;
  excerpt: string;
  content: string;
  coverImage?: string;
  readTime?: string;
  publishedAt?: string;
  isActive?: boolean;
}

export interface DropshipPageContent {
  badge?: string;
  heroHeading?: string;
  heroSubheading?: string;
  ctaText?: string;
  formBadge?: string;
  formHeading?: string;
  formSubheading?: string;
  orderVolumeOptions?: string[];
}

export interface HomepageHeadingsData {
  categoriesTitle?: string;
  categoriesSubtitle?: string;
  collectionsTitle?: string;
  collectionsSubtitle?: string;
  trendingTitle?: string;
  trendingSubtitle?: string;
  newArrivalsTitle?: string;
  newArrivalsSubtitle?: string;
  recommendedTitle?: string;
  testimonialsTitle?: string;
  testimonialsSubtitle?: string;
}

export interface HomepageVisibilityData {
  showHeroBanners?: boolean;
  showTrustBar?: boolean;
  showCategories?: boolean;
  showFeaturedCollections?: boolean;
  showWholesaleBiz?: boolean;
  showTrendingProducts?: boolean;
  showNewArrivals?: boolean;
  showDropshipBiz?: boolean;
  showBrandPartners?: boolean;
  showRecommendedProducts?: boolean;
  showTestimonials?: boolean;
}

/**
 * Homepage layout model.
 *
 * `homepage_settings` (HomepageVisibilityData) only ever stored *visibility*; the render
 * order was hardcoded in the homepage component. The layout below owns both, so an admin
 * can reorder sections and drop custom banner sections between them.
 *
 * Backward compatibility: when no `homepage_layout` document exists, one is derived from
 * the historical hardcoded order plus the existing visibility booleans, so a store that
 * has never opened the new tab renders exactly as before. See lib/homepageLayout.ts.
 */

/** The sections that ship with the homepage, in their historical render order. */
export type BuiltinSectionKey =
  | "hero"
  | "trustBar"
  | "categories"
  | "featuredCollections"
  | "wholesaleBiz"
  | "trendingProducts"
  | "newArrivals"
  | "dropshipBiz"
  | "brandPartners"
  | "recommendedProducts"
  | "testimonials";

export type LayoutSection =
  | { id: string; kind: "builtin"; key: BuiltinSectionKey; visible: boolean }
  | { id: string; kind: "banner"; bannerSectionId: string; visible: boolean }
  | { id: string; kind: "location"; visible: boolean };

export interface HomepageLayout {
  /** Bumped only on a breaking shape change, so a migration can be targeted. */
  version: 1;
  /** Render order is array order. */
  sections: LayoutSection[];
}

/** A custom, admin-created band of banners that can sit anywhere in the layout. */
export interface BannerSection {
  id: string;
  /** Admin-facing label; never rendered on the storefront. */
  name: string;
  /** Optional visible heading above the banners. */
  heading?: string;
  subheading?: string;
  displayMode: "carousel" | "grid";
  /**
   * Fixed container ratio for EVERY banner in this section, as a "W:H" key.
   *
   * Unlike the hero — which sizes itself from each slide's natural dimensions and so
   * resizes as it rotates — a banner section reserves one box up front and crops images
   * into it. That is what keeps the page from shifting when a section holds two or more
   * differently shaped images.
   */
  aspectRatio?: string;
  /** Separate ratio below 640px. Falls back to `aspectRatio` when unset. */
  mobileAspectRatio?: string;
  /** Grid mode only. */
  gridColumns?: 1 | 2 | 3 | 4;
  /** Carousel mode only. Defaults to true. */
  autoplay?: boolean;
  /** Edge-to-edge instead of the standard max-w-8xl container. */
  fullWidth?: boolean;
  banners: BannerSlide[];
  isActive: boolean;
}

export interface LocationSectionData {
  heading?: string;
  subheading?: string;
  address?: string;
  phone?: string;
  email?: string;
  timings?: string;
  /** Google Maps embed URL, loaded only after the visitor asks for it. */
  mapEmbedUrl?: string;
  directionsUrl?: string;
  /** Static image shown in place of the map until the visitor opts in. */
  staticMapImageUrl?: string;
  isActive?: boolean;
}

export interface HomepageSeoData {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  ogImageUrl?: string;
}

export type CmsTabType =
  | "homepage"
  | "hero"
  | "announcements"
  | "trust"
  | "wholesale_biz"
  | "dropship_biz"
  | "testimonials"
  | "testimonials_wholesale"
  | "testimonials_dropship"
  | "testimonials_client"
  | "partners"
  | "homepage_layout"
  | "homepage_location"
  /**
   * Retired — the Page Layout tab owns visibility now. Kept in the union only so
   * bookmarked `?tab=homepage_visibility` URLs can be recognised and redirected.
   */
  | "homepage_visibility"
  | "homepage_seo"
  | "blogs"
  | "dropship_page"
  | "faqs"
  | "policies"
  | "footer";
