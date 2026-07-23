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

export const revalidate = 3600; // ISR revalidation every hour

export default async function HomePage() {
  await dbConnect();

  // Fetch CMS sections
  const cmsHeroBanners = await CmsContent.findOne({ key: "hero_banners" });
  const cmsTrustStats = await CmsContent.findOne({ key: "trust_stats" });
  const cmsWholesaleBiz = await CmsContent.findOne({ key: "wholesale_business_details" });
  const cmsDropshipBiz = await CmsContent.findOne({ key: "dropshipping_business_details" });
  const cmsTestimonialsWholesale = await CmsContent.findOne({ key: "testimonials_wholesale" });
  const cmsTestimonialsDropshipper = await CmsContent.findOne({ key: "testimonials_dropshipper" });
  const cmsTestimonialsClient = await CmsContent.findOne({ key: "testimonials_client" });
  const cmsBrandPartners = await CmsContent.findOne({ key: "brand_partners" });

  const categories = await categoryService.getCategories();
  const products = await productService.getProducts();
  const trendingProducts = await productService.getTrendingProducts();
  const newArrivals = await productService.getNewArrivals();
  const collections = await collectionService.getCollections();

  // Resolve product counts for each featured collection
  const productCounts: Record<string, number> = {};
  for (const col of collections) {
    if (col.isActive && col.isFeatured) {
      try {
        const colProducts = await collectionService.getCollectionProducts(col._id);
        productCounts[col._id] = colProducts.length;
      } catch (err) {
        console.error(`Failed to load product count for collection ${col._id}`, err);
        productCounts[col._id] = 0;
      }
    }
  }

  const heroBanners = cmsHeroBanners?.value || [
    {
      mediaType: "video",
      videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-cargo-ship-loading-containers-in-a-port-42847-large.mp4",
      posterUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80",
      imageUrl: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1920&q=80",
      redirectUrl: "/products",
      altText: "FlexSell Wholesale B2B Cargo Freight & Sourcing",
      overlayTitle: "Global B2B Wholesale & Logistics Platform",
      overlaySubtitle: "Direct factory sourcing, bulk discounts, and streamlined cargo logistics worldwide.",
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

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* High Performance Video & Image Hero Banner Carousel */}
      <HeroCarousel slides={heroBanners} />

      {/* Trust Stats Bar */}
      <TrustBar stats={cmsTrustStats?.value} />

      {/* Categories Grid Section */}
      <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4">
        <div className="flex justify-between items-end mb-8 border-b pb-4 border-border/60">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Shop by Category
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Sourced direct from global factory lines.</p>
          </div>
          <Link href="/categories" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            View All Categories &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {categories.filter(c => !c.parentId).slice(0, 6).map((category) => (
            <Link key={category._id} href={`/categories/${category.slug}`}>
              <Card className="hover:border-primary/50 transition-all hover:shadow-md cursor-pointer text-center overflow-hidden h-full flex flex-col group bg-card border-border">
                <div className="aspect-square relative bg-secondary overflow-hidden">
                  <Image
                    src={category.image || `https://placehold.co/400x400/10b981/ffffff?text=${encodeURIComponent(category.name)}`}
                    alt={category.name}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 16vw"
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

      {/* Featured Collections Section */}
      <FeaturedCollections collections={collections} productCounts={productCounts} />

      {/* Independent B2B Wholesale Business Section */}
      <WholesaleBusinessSection data={cmsWholesaleBiz?.value} />

      {/* Trending Products Grid Section */}
      <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4">
        <div className="flex justify-between items-end mb-8 border-b pb-4 border-border/60">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Trending Consumer Gadgets
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Our fastest selling consumer products and gadgets.</p>
          </div>
          <Link href="/products" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            View All &rarr;
          </Link>
        </div>

        <TrendingProducts initialProducts={trendingProducts} />
      </section>

      {/* New Arrivals Section */}
      {newArrivals.length > 0 && (
        <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4 animate-in fade-in duration-700">
          <div className="flex justify-between items-end mb-8 border-b pb-4 border-border/60">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
                New Arrivals
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Our latest wholesale products added in the last 7 days.</p>
            </div>
            <Link href="/products?sort=newest" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              View All &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {newArrivals.map((product) => (
              <ProductCard key={product._id} product={product} layout="grid" />
            ))}
          </div>
        </section>
      )}

      {/* Independent Dropshipping Business Section */}
      <DropshippingBusinessSection data={cmsDropshipBiz?.value} />

      {/* Brand Partners Marquee Bar */}
      <BrandPartnersBar partners={cmsBrandPartners?.value} />

      {/* Recently Viewed Carousel (Last 10 Products) */}
      <RecentlyViewed initialProducts={products} />

      {/* Unified Single Frame Testimonials with 3-Tab Options */}
      <TestimonialsSection
        title="Partner & Client Feedback"
        subtitle="Verified reviews across wholesale buyers, dropshipper partners, and retail clients."
        wholesaleTestimonials={cmsTestimonialsWholesale?.value}
        dropshipTestimonials={cmsTestimonialsDropshipper?.value}
        clientTestimonials={cmsTestimonialsClient?.value}
      />
    </div>
  );
}
