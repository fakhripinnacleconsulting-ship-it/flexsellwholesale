import * as React from "react";
import { productService } from "@/services/productService";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productService.getProductBySlug(slug);
    const defaultVariant = product.colorVariants?.[0];
    const sku = defaultVariant?.subVariants?.[0]?.sku || "NO SKU";
    const firstImg = defaultVariant?.images?.[0];
    const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";
    return {
      title: product.seoTitle || `${product.title} - Factory Wholesale Price`,
      description: product.seoDescription || `Buy ${product.title} at factory direct wholesale rates. SKU: ${sku}. ${product.description.slice(0, 150)}...`,
      keywords: product.seoKeywords || product.tags?.join(", ") || "",
      openGraph: {
        title: product.seoTitle || `${product.title} | FlexSell Wholesale`,
        description: product.seoDescription || product.description,
        images: [{ url: imgUrl }]
      }
    };
  } catch (error) {
    return {
      title: "Product Not Found | FlexSell Wholesale"
    };
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  try {
    const product = await productService.getProductBySlug(slug);
    const products = await productService.getProducts();

    // Prepare JSON-LD Product Schema data
    const prices = product.colorVariants?.flatMap(cv => cv.subVariants?.map(sv => sv.b2cPrice) || []) || [0];
    const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const highPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const offerCount = product.colorVariants?.flatMap(cv => cv.subVariants || []).length || 1;

    const productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.title,
      "image": (product.colorVariants?.[0]?.images || []).map(img => typeof img === "string" ? img : img.url || ""),
      "description": product.description,
      "sku": product.colorVariants?.[0]?.subVariants?.[0]?.sku || "NO SKU",
      "mpn": product.colorVariants?.[0]?.subVariants?.[0]?.sku || "NO SKU",
      "brand": {
        "@type": "Brand",
        "name": "FlexSell Wholesale"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.rating || 4.5,
        "reviewCount": product.reviewCount || 10
      },
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "INR",
        "lowPrice": lowPrice,
        "highPrice": highPrice,
        "offerCount": offerCount,
        "priceIncludesGst": product.priceIncludesGst ?? true,
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "FlexSell Wholesale"
        }
      }
    };

    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://flexsellwholesale.in"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Products",
          "item": "https://flexsellwholesale.in/products"
        },
        {
          "@type": "ListItem",
          "position": 3,
          "name": product.title,
          "item": `https://flexsellwholesale.in/products/${product.slug}`
        }
      ]
    };

    const orgJsonLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "FlexSell Wholesale",
      "url": "https://flexsellwholesale.in",
      "logo": "https://flexsellwholesale.in/images/logo/logo-light.svg",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+91-261-2409000",
        "contactType": "customer service",
        "email": "wholesale@flexsell.in",
        "areaServed": "IN",
        "availableLanguage": "en"
      }
    };

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <ProductDetailView slug={slug} initialProducts={products} />
      </>
    );
  } catch (error) {
    return notFound();
  }
}
