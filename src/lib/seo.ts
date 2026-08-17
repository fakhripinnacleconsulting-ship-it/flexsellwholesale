import type { Metadata } from "next";
import { Product } from "@/types";

/**
 * Canonical site origin.
 *
 * Normalised defensively: a misconfigured env var (http scheme, or a trailing slash)
 * would otherwise leak into every canonical, og:url, hreflang, JSON-LD @id and sitemap
 * entry as e.g. "http://flexsellwholesale.com//products" — which splits link equity and
 * costs an http->https redirect on every crawler hit.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://flexsellwholesale.com")
  .trim()
  .replace(/\/+$/, "")
  .replace(/^http:\/\//i, "https://");
export const DOMAIN_ALT = "https://flexsellwholesale.com";
export const BRAND_NAME = "FlexSell Wholesale";
export const BRAND_SHORT = "FlexSell";

// Default System Keywords for General SEO & AI Generative Search Engines (Including Misspelling & Typo Variations)
export const DEFAULT_KEYWORDS = [
  // Primary Brand & Misspellings / Typos
  "FlexSell", "FlexSell Wholesale", "FlexSellWholesale", "FlexSell India", "FlexSell B2B",
  "Flexsel", "Flexsell", "Fleksell", "Flex sell", "Flxsell", "Flex cell", "Flexcel", "Flexsale",
  "Flex sell wholesale", "Flexsel wholesale", "Flexsell login", "Flexsell app", "Flexsell marketplace",

  // B2B & Wholesale Terminology & Typos
  "wholesale marketplace India", "factory direct wholesale", "B2B ecommerce Bhopal",
  "dropshipping supplier India", "bulk buying India", "manufacturer price online",
  "wholesale market", "bulk buy India", "factory price", "reseller supplier", "B2B marketplace",
  "wholesail", "holesale", "wohlesale", "wholestore", "bulksale", "bluk buy", "bluk purchasing", "reseler", "resseller", "factory direct rate",

  // Competitor & Market Terms (Targeted Alternatives & Typos)
  "Deodap alternative", "Deodap wholesale", "India B2B portal",
  "Diodap", "Deodapp", "Deodap wholesal", "Deodap dropshiping", "Diodap wholesale",

  // Category, Household & Product Terms & Typos
  "kitchen gadgets wholesale", "household products direct importer", "reseller wholesale portal",
  "kitchen gadgets", "household utilities", "smart home products", "home organizer",
  "kichen gadgets", "kichen tools", "home utlities", "home utillities", "house hold items", "smart kichen", "organiser home",

  // Dropshipping & E-Commerce Terms & Typos
  "dropshipping supplier India", "blind dropshipping", "zero investment business",
  "dropshiping", "dropshipin", "drop sping", "dropshippin", "blind dropshiping", "ecomerce sourcing",

  // Geographic & Location Terms & Typos
  "wholesale Bhopal", "Madhya Pradesh B2B", "Central India wholesaler",
  "wholsale Bhopal", "Bhopal wholesail", "MP wholesale"
];

interface DynamicSEOProps {
  title?: string;
  description?: string;
  keywords?: string[] | string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}

/**
 * Generate standard Next.js Metadata object with full OpenGraph, Twitter Cards,
 * Robots rules, and Canonical URLs.
 */
export function constructMetadata({
  title,
  description,
  keywords,
  path = "",
  image,
  type = "website",
  noIndex = false,
}: DynamicSEOProps = {}): Metadata {
  const fullTitle = title ? `${title} | ${BRAND_NAME}` : `${BRAND_NAME} - B2B Wholesale & Sourcing Marketplace India`;
  const fullDescription = description || "Source household utilities, kitchen tools, gadgets, and consumer goods directly from factory manufacturers. Low MOQs, fast dispatch, and GST invoices.";
  const canonicalUrl = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const ogImageUrl = image || `${SITE_URL}/Flexsell%20Logo.png`;

  let keywordList: string[];
  if (Array.isArray(keywords)) {
    keywordList = Array.from(new Set([...keywords, ...DEFAULT_KEYWORDS]));
  } else if (typeof keywords === "string") {
    keywordList = Array.from(new Set([...keywords.split(",").map(k => k.trim()), ...DEFAULT_KEYWORDS]));
  } else {
    keywordList = DEFAULT_KEYWORDS;
  }

  return {
    title: fullTitle,
    description: fullDescription,
    keywords: keywordList,
    authors: [{ name: "FlexSell Tech & SEO Team" }],
    creator: BRAND_NAME,
    publisher: BRAND_NAME,
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        "en-IN": canonicalUrl,
        "hi-IN": canonicalUrl,
      },
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      url: canonicalUrl,
      siteName: BRAND_NAME,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title || BRAND_NAME,
        },
      ],
      locale: "en_IN",
      type,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      images: [ogImageUrl],
      creator: "@FlexSellB2B",
      site: "@FlexSellB2B",
    },
  };
}

/* ==========================================================================
   JSON-LD STRUCTURED DATA SCHEMAS FOR GOOGLE, BING, GEMINI, PERPLEXITY & AI
   ========================================================================== */

/** Organization Schema */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": BRAND_NAME,
    "alternateName": ["FlexSell", "FlexSellWholesale", "FlexSell India", "FlexSell B2B Marketplace"],
    "url": SITE_URL,
    "sameAs": [
      DOMAIN_ALT,
      "https://facebook.com/flexsellwholesale",
      "https://instagram.com/flexsellwholesale",
      "https://linkedin.com/company/flexsellwholesale",
      "https://youtube.com/@flexsellwholesale"
    ],
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/Flexsell%20Logo.png`,
      "caption": "FlexSell Wholesale Logo"
    },
    "contactPoint": [
      {
        "@type": "ContactPoint",
        "telephone": "+91-88877-66655",
        "contactType": "customer service",
        "email": "support@flexsellwholesale.com",
        "areaServed": "IN",
        "availableLanguage": ["English", "Hindi"]
      },
      {
        "@type": "ContactPoint",
        "telephone": "+91-88877-66655",
        "contactType": "sales",
        "email": "b2b@flexsellwholesale.com",
        "areaServed": "IN",
        "availableLanguage": ["English", "Hindi"]
      }
    ]
  };
}

/** WebSite & SearchAction Schema (For Google Sitelinks Search Box) */
export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "url": SITE_URL,
    "name": BRAND_NAME,
    "alternateName": "FlexSell Wholesale Marketplace",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

/** LocalBusiness Schema (Central India Bhopal Wholesale Hub) */
export function generateLocalBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WholesaleStore",
    "@id": `${SITE_URL}/#localbusiness`,
    "name": BRAND_NAME,
    "image": `${SITE_URL}/Flexsell%20Logo.png`,
    "url": SITE_URL,
    "telephone": "+91-88877-66655",
    "priceRange": "₹₹",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "FlexSell Central Logistics Hub, Industrial Area",
      "addressLocality": "Bhopal",
      "addressRegion": "Madhya Pradesh",
      "postalCode": "462001",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 23.2599,
      "longitude": 77.4126
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "opens": "09:00",
        "closes": "20:00"
      }
    ]
  };
}

/** Product Schema with AggregateOffer, MerchantReturn, and Reviews */
export function generateProductSchema(product: Product, canonicalPath?: string) {
  const images = (product.colorVariants || []).flatMap(cv =>
    (cv.images || []).map(img => typeof img === "string" ? img : img.url || "")
  ).filter(Boolean);

  const prices = (product.colorVariants || []).flatMap(cv =>
    (cv.subVariants || []).map(sv => sv.b2cPrice || sv.b2bPrice || 0)
  ).filter(p => p > 0);

  const minPrice = prices.length > 0 ? Math.min(...prices) : 99;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 999;
  const totalStock = (product.colorVariants || []).flatMap(cv =>
    (cv.subVariants || []).map(sv => sv.stock || 0)
  ).reduce((a, b) => a + b, 0);

  // Falls back to the id, matching the canonical route. A slug fallback here would emit
  // structured data pointing at a URL that immediately redirects.
  const productUrl = `${SITE_URL}${canonicalPath || `/products/${product._id}`}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    "url": productUrl,
    "name": product.title,
    "image": images.length > 0 ? images : [`${SITE_URL}/Flexsell%20Logo.png`],
    "description": product.description,
    "sku": product.colorVariants?.[0]?.subVariants?.[0]?.sku || product._id,
    "mpn": product.colorVariants?.[0]?.subVariants?.[0]?.sku || product._id,
    "brand": {
      "@type": "Brand",
      "name": BRAND_NAME
    },
    "aggregateRating": product.reviewCount && product.reviewCount > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": product.rating || 4.8,
      "reviewCount": product.reviewCount || 12,
      "bestRating": "5",
      "worstRating": "1"
    } : undefined,
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "INR",
      "lowPrice": minPrice,
      "highPrice": maxPrice,
      "offerCount": prices.length || 1,
      "priceValidUntil": "2030-12-31",
      "availability": totalStock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "seller": {
        "@type": "Organization",
        "name": BRAND_NAME
      },
      "hasMerchantReturnPolicy": {
        "@type": "MerchantReturnPolicy",
        "applicableCountry": "IN",
        "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnPeriod",
        "merchantReturnDays": 7,
        "returnMethod": "https://schema.org/ReturnByMail"
      },
      "shippingDetails": {
        "@type": "OfferShippingDetails",
        "shippingRate": {
          "@type": "MonetaryAmount",
          "value": "0",
          "currency": "INR"
        },
        "shippingDestination": {
          "@type": "DefinedRegion",
          "addressCountry": "IN"
        },
        "deliveryTime": {
          "@type": "ShippingDeliveryTime",
          "handlingTime": {
            "@type": "QuantitativeValue",
            "minValue": 1,
            "maxValue": 2,
            "unitCode": "DAY"
          },
          "transitTime": {
            "@type": "QuantitativeValue",
            "minValue": 2,
            "maxValue": 5,
            "unitCode": "DAY"
          }
        }
      }
    }
  };
}

/** Breadcrumb Schema */
export function generateBreadcrumbSchema(items: { label: string; href: string }[]) {
  const itemListElement = items.map((item, idx) => ({
    "@type": "ListItem",
    "position": idx + 1,
    "name": item.label,
    "item": item.href.startsWith("http") ? item.href : `${SITE_URL}${item.href}`
  }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": SITE_URL
      },
      ...itemListElement.map((el, i) => ({ ...el, position: i + 2 }))
    ]
  };
}

/** FAQ Schema */
export function generateFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/** Blog Article / Post Schema */
export function generateBlogArticleSchema(article: {
  title: string;
  description?: string;
  slug: string;
  coverImage?: string;
  author?: string;
  publishedAt?: string;
  updatedAt?: string;
}) {
  const articleUrl = `${SITE_URL}/blogs/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${articleUrl}#article`,
    "url": articleUrl,
    "headline": article.title,
    "description": article.description || article.title,
    "image": article.coverImage ? [article.coverImage] : [`${SITE_URL}/Flexsell%20Logo.png`],
    "datePublished": article.publishedAt || new Date().toISOString(),
    "dateModified": article.updatedAt || article.publishedAt || new Date().toISOString(),
    "author": {
      "@type": "Person",
      "name": article.author || "FlexSell Editorial Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": BRAND_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/Flexsell%20Logo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": articleUrl
    }
  };
}

/** Collection Schema */
export function generateCollectionSchema(collection: {
  title: string;
  description?: string;
  slug: string;
  bannerImage?: string;
}) {
  const collectionUrl = `${SITE_URL}/collections/${collection.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${collectionUrl}#collection`,
    "url": collectionUrl,
    "name": collection.title,
    "description": collection.description || `Browse ${collection.title} at direct factory wholesale rates.`,
    "image": collection.bannerImage ? [collection.bannerImage] : [`${SITE_URL}/Flexsell%20Logo.png`],
    "publisher": {
      "@type": "Organization",
      "name": BRAND_NAME
    }
  };
}

/** Category Schema */
export function generateCategorySchema(category: {
  name: string;
  description?: string;
  slug: string;
  image?: string;
}) {
  const categoryUrl = `${SITE_URL}/categories/${category.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${categoryUrl}#category`,
    "url": categoryUrl,
    "name": category.name,
    "description": category.description || `Sourcing factory direct wholesale items in ${category.name}.`,
    "image": category.image ? [category.image] : [`${SITE_URL}/Flexsell%20Logo.png`],
    "publisher": {
      "@type": "Organization",
      "name": BRAND_NAME
    }
  };
}

