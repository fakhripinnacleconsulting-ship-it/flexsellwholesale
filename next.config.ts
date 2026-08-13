import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "flexsellwholesale.com" },
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "assets.mixkit.co" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "*.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "*.ssl-images-amazon.com" },
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // Bounded transformation budget. Inert while `unoptimized: true`, but in place so
    // enabling optimisation is a one-line change with a known ceiling rather than an
    // open-ended bill: transformations are billed per unique (source, size, quality)
    // combination and then cached for minimumCacheTTL. 4 device sizes x 2 image sizes at
    // a single quality caps it at ~6 variants per source image, charged once a year.
    deviceSizes: [640, 828, 1080, 1920],
    imageSizes: [128, 256],
    qualities: [75],
    minimumCacheTTL: 31536000,
    formats: ["image/webp"],

    // ⚠️ DO NOT flip this to `false` until the production image-host audit is done.
    //
    // `remotePatterns` above still contains `{ hostname: "**" }` for http and https, so
    // the current list is NOT evidence of which hosts are actually in use — anything
    // omitted from a tightened list starts returning 400 for every image from it.
    //
    // Before enabling optimisation:
    //   1. Enumerate real hosts from production Mongo — products.colorVariants.images,
    //      categories.image, collections.image/bannerImage, and the CmsContent blobs
    //      (hero_banners, brand_partners, testimonials_*, blogs).
    //   2. Replace remotePatterns with that explicit list (drop both "**" entries).
    //   3. Set dangerouslyAllowSVG: false — with a wildcard host it makes /_next/image
    //      a public open proxy and an SVG XSS vector.
    //   4. Deploy, then watch Vercel logs + Sentry for image 400s for 24h.
    //
    // Until then this stays true: larger payloads, but zero broken images.
    unoptimized: true,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@sentry/nextjs",
      "framer-motion",
      "embla-carousel-react",
    ],
  },
  async headers() {
    return [
      // Public read-only API routes — allow CDN edge caching but force browser to revalidate
      {
        source: "/api/(products|categories|collections|search|cms|reviews|health)(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
        ],
      },
      // Auth, admin, and state-changing API routes — never cache
      {
        source: "/api/(auth|admin|orders|invoices|customers|notifications|coupons|push|razorpay|shipping|shiprocket|upload|inventory)(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : ""} https://checkout.razorpay.com https://accounts.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://tagassistant.google.com https://www.google-analytics.com https://ssl.google-analytics.com https://connect.facebook.net`.replace(/\s+/g, " "),
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagassistant.google.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://flexsellwholesale.com https://*.gstatic.com https://*.googleusercontent.com https://www.googletagmanager.com https://*.google-analytics.com https://ssl.google-analytics.com https://*.doubleclick.net https://www.facebook.com http://* https://*",
              "connect-src 'self' https://api.razorpay.com https://*.sentry.io https://*.upstash.io https://accounts.google.com https://oauth2.googleapis.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://stats.g.doubleclick.net https://tagassistant.google.com https://connect.facebook.net https://www.facebook.com",
              "frame-src 'self' https://api.razorpay.com https://accounts.google.com https://www.googletagmanager.com https://tagassistant.google.com https://www.facebook.com https://connect.facebook.net",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/policies/privacy-policy", destination: "/policies/privacy", permanent: true },
      { source: "/policies/terms-of-service", destination: "/policies/terms", permanent: true },
      { source: "/policies/shipping-policy", destination: "/policies/shipping", permanent: true },
      { source: "/policies/return-policy", destination: "/policies/return", permanent: true },
      { source: "/policies/refund", destination: "/policies/return", permanent: true },
      { source: "/policies/refund-policy", destination: "/policies/return", permanent: true },
      { source: "/policies/cancellation", destination: "/policies/terms", permanent: true },
    ];
  },
};

export default nextConfig;
