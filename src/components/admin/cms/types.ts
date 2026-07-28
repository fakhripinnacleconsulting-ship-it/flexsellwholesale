export interface BannerSlide {
  mediaType?: "image" | "video";
  imageUrl: string;
  mobileImageUrl?: string;
  videoUrl?: string;
  mobileVideoUrl?: string;
  posterUrl?: string;
  redirectUrl: string;
  altText?: string;
  overlayTitle?: string;
  overlaySubtitle?: string;
  ctaText?: string;
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
  | "homepage_visibility"
  | "homepage_seo"
  | "blogs"
  | "dropship_page"
  | "faqs"
  | "policies"
  | "footer";
