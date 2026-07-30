import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
  },
  async headers() {
    return [
      // Public read-only API routes — allow CDN edge caching
      {
        source: "/api/(products|categories|collections|search|cms|reviews|health)(.*)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=120" },
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
              `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== "production" ? "'unsafe-eval'" : ""} https://checkout.razorpay.com https://accounts.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://tagassistant.google.com https://www.google-analytics.com https://ssl.google-analytics.com`.replace(/\s+/g, " "),
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://tagassistant.google.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://flexsellwholesale.in https://*.gstatic.com https://*.googleusercontent.com https://www.googletagmanager.com https://*.google-analytics.com https://ssl.google-analytics.com https://*.doubleclick.net http://* https://*",
              "connect-src 'self' https://api.razorpay.com https://*.sentry.io https://*.upstash.io https://accounts.google.com https://oauth2.googleapis.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://stats.g.doubleclick.net https://tagassistant.google.com",
              "frame-src 'self' https://api.razorpay.com https://accounts.google.com https://www.googletagmanager.com https://tagassistant.google.com",
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
