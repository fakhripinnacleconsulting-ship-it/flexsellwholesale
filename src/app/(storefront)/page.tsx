import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { categoryService } from "@/services/categoryService";
import { productService } from "@/services/productService";
import { collectionService } from "@/services/collectionService";
import { Card } from "@/components/ui/Card";
import dbConnect from "@/lib/dbConnect";
import CmsContent from "@/models/CmsContent";

import { TrendingProducts } from "@/components/storefront/TrendingProducts";
import { ProductCard } from "@/components/storefront/ProductCard";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { TrustBar } from "@/components/storefront/TrustBar";
import { RecentlyViewed } from "@/components/storefront/RecentlyViewed";
import { WholesaleBusinessSection } from "@/components/storefront/WholesaleBusinessSection";
import { DropshippingBusinessSection } from "@/components/storefront/DropshippingBusinessSection";
import { TestimonialsSection } from "@/components/storefront/TestimonialsSection";
import { BrandPartnersBar } from "@/components/storefront/BrandPartnersBar";
import { FeaturedCollections } from "@/components/storefront/FeaturedCollections";

import { constructMetadata } from "@/lib/seo";

export const revalidate = 60; // ISR revalidation every 60s

export async function generateMetadata(): Promise<Metadata> {
  try {
    await dbConnect();
    const seoRes = await CmsContent.findOne({ key: "homepage_seo" }).lean();
    const seo = seoRes?.value || {};

    const title = seo.seoTitle || "FlexSell Wholesale | India's Leading B2B Sourcing Platform";
    const description = seo.seoDescription || "Direct factory wholesale sourcing, automated dropshipping fulfillment, and bulk tier pricing for Indian retailers and e-commerce sellers.";
    const keywords = seo.seoKeywords || "";
    const ogImage = seo.ogImageUrl || "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80";

    return constructMetadata({
      title,
      description,
      keywords,
      image: ogImage,
      path: "/",
    });
  } catch (err) {
    return constructMetadata({
      title: "FlexSell Wholesale | India's Leading B2B Sourcing Platform",
      description: "Direct factory wholesale sourcing and bulk tier pricing for Indian retailers.",
      path: "/",
    });
  }
}

export default async function HomePage() {
  let cmsHeroBanners: any = null;
  let cmsTrustStats: any = null;
  let cmsWholesaleBiz: any = null;
  let cmsDropshipBiz: any = null;
  let cmsTestimonialsWholesale: any = null;
  let cmsTestimonialsDropshipper: any = null;
  let cmsTestimonialsClient: any = null;
  let cmsBrandPartners: any = null;
  let cmsSettings: any = null;

  let categories: any[] = [];
  let products: any[] = [];
  let trendingProducts: any[] = [];
  let newArrivals: any[] = [];
  let collections: any[] = [];

  try {
    await dbConnect();

    const cmsKeys = [
      "hero_banners",
      "trust_stats",
      "wholesale_business_details",
      "dropshipping_business_details",
      "testimonials_wholesale",
      "testimonials_dropshipper",
      "testimonials_client",
      "brand_partners",
      "homepage_settings"
    ];

    // Fetch CMS content in a single query along with storefront data in parallel
    const [
      cmsDocs,
      categoriesRes,
      trendingRes,
      newArrivalsRes,
      collectionsRes,
      productsRes
    ] = await Promise.all([
      CmsContent.find({ key: { $in: cmsKeys } }).lean(),
      categoryService.getCategories(),
      productService.getTrendingProducts(),
      productService.getNewArrivals(),
      collectionService.getCollections(),
      productService.getProducts({ limit: 10 })
    ]);

    const cmsMap = new Map((cmsDocs || []).map((doc: any) => [doc.key, doc]));

    cmsHeroBanners = cmsMap.get("hero_banners");
    cmsTrustStats = cmsMap.get("trust_stats");
    cmsWholesaleBiz = cmsMap.get("wholesale_business_details");
    cmsDropshipBiz = cmsMap.get("dropshipping_business_details");
    cmsTestimonialsWholesale = cmsMap.get("testimonials_wholesale");
    cmsTestimonialsDropshipper = cmsMap.get("testimonials_dropshipper");
    cmsTestimonialsClient = cmsMap.get("testimonials_client");
    cmsBrandPartners = cmsMap.get("brand_partners");
    cmsSettings = cmsMap.get("homepage_settings");

    categories = categoriesRes;
    trendingProducts = trendingRes;
    newArrivals = newArrivalsRes;
    collections = collectionsRes;
    products = productsRes;
  } catch (err) {
    console.error("HomePage DB fetch notice (using fallback content):", (err as any)?.message || err);
  }

  // Calculate product counts for featured collections without N+1 queries
  const productCounts: Record<string, number> = {};
  const featuredCols = collections.filter(c => c.isActive && c.isFeatured).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const col of featuredCols) {
    productCounts[col._id] = Array.isArray(col.productIds) ? col.productIds.length : 0;
  }

  const heroBanners = cmsHeroBanners?.value || [
    {
      mediaType: "video",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cargo-ship-loading-containers-in-a-port-42847-large.mp4",
      posterUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80",
      imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80",
      redirectUrl: "/products",
      altText: "FlexSell Wholesale B2B Freight & Sourcing",
      overlayTitle: "Global B2B Wholesale & Logistics Platform",
      overlaySubtitle: "Direct factory sourcing, bulk discounts, and streamlined order logistics worldwide.",
      ctaText: "Browse Catalogue"
    },
    {
      mediaType: "image",
      imageUrl: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=1920&q=80",
      redirectUrl: "/dropshipping",
      altText: "FlexSell Dropshipping Supply Chain",
      overlayTitle: "Automated Dropshipping Fulfilment",
      overlaySubtitle: "Scale your e-commerce storefront with zero inventory risk and instant automated dispatch.",
      ctaText: "Start Dropshipping"
    }
  ];

  const topLevelCategories = categories.filter(c => !c.parentId);

  const settings = cmsSettings?.value || {};

  return (
    <div className="flex flex-col gap-10 md:gap-14 pb-16">
      {/* High Performance Video & Image Hero Banner Carousel */}
      {settings.showHeroBanners !== false && <HeroCarousel slides={heroBanners} />}

      {/* Trust Stats Bar */}
      {settings.showTrustBar !== false && <TrustBar stats={cmsTrustStats?.value} />}

      {/* Categories Grid Section */}
      {settings.showCategories !== false && topLevelCategories.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-2 sm:py-4">
          <div className="flex justify-between items-end mb-6 sm:mb-8 border-b pb-4 border-border/60">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                Shop Top Product Categories
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Direct factory products sourced at lowest wholesale rates from Central India.
              </p>
            </div>
            <Link href="/categories" className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All Categories &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
            {topLevelCategories.slice(0, 6).map((category) => (
              <Link key={category._id} href={`/categories/${category.slug}`}>
                <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer text-center overflow-hidden h-full flex flex-col group bg-card border-border">
                  <div className="aspect-square relative bg-secondary overflow-hidden">
                    <Image
                      src={category.image || `https://placehold.co/400x400/10b981/ffffff?text=${encodeURIComponent(category.name)}`}
                      alt={category.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3 mt-auto bg-card border-t border-border">
                    <p className="text-xs font-bold text-foreground line-clamp-2">{category.name}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Collections Section */}
      {settings.showFeaturedCollections !== false && featuredCols.length > 0 && (
        <FeaturedCollections
          collections={collections}
          productCounts={productCounts}
        />
      )}

      {/* Independent B2B Wholesale Business Section */}
      {settings.showWholesaleBiz !== false && <WholesaleBusinessSection data={cmsWholesaleBiz?.value} />}

      {/* Trending Products Grid Section */}
      {settings.showTrendingProducts !== false && trendingProducts && trendingProducts.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-2 sm:py-4">
          <div className="flex justify-between items-end mb-6 sm:mb-8 border-b pb-4 border-border/60">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                Fast Selling Consumer Products
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Our highest demand products selling fast across Indian retail shops.
              </p>
            </div>
            <Link href="/products" className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All &rarr;
            </Link>
          </div>

          <TrendingProducts initialProducts={trendingProducts} />
        </section>
      )}

      {/* New Arrivals Section */}
      {settings.showNewArrivals !== false && newArrivals.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-2 sm:py-4 animate-in fade-in duration-700">
          <div className="flex justify-between items-end mb-6 sm:mb-8 border-b pb-4 border-border/60">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                Fresh Stock & New Arrivals
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Latest wholesale stock items added to our warehouse this week.
              </p>
            </div>
            <Link href="/products?sort=newest" className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-6">
            {newArrivals.map((product) => (
              <ProductCard key={product._id} product={product} layout="grid" />
            ))}
          </div>
        </section>
      )}

      {/* Independent Dropshipping Business Section */}
      {settings.showDropshipBiz !== false && <DropshippingBusinessSection data={cmsDropshipBiz?.value} />}

      {/* Brand Partners Marquee Bar */}
      {settings.showBrandPartners !== false && cmsBrandPartners?.value && cmsBrandPartners.value.length > 0 && (
        <BrandPartnersBar partners={cmsBrandPartners.value} />
      )}

      {/* Recently Viewed / Recommended Carousel */}
      {settings.showRecommendedProducts !== false && products && products.length > 0 && (
        <RecentlyViewed initialProducts={products} />
      )}

      {/* Unified Single Frame Testimonials with 3-Tab Options */}
      {settings.showTestimonials !== false && (
        <TestimonialsSection
          title="What Our Retailers & Partners Say"
          subtitle="Real reviews from shopkeepers, online sellers, and dropship partners across India."
          wholesaleTestimonials={cmsTestimonialsWholesale?.value}
          dropshipTestimonials={cmsTestimonialsDropshipper?.value}
          clientTestimonials={cmsTestimonialsClient?.value}
        />
      )}
    </div>
  );
}
