import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flexsellwholesale.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/client/",
          "/api/",
          "/checkout/",
          "/cart/",
          "/reset-password/",
          "/system-diagnostics/"
        ],
      },
      // Explicit Rules for AI Search Engines & Conversational Assistants
      {
        userAgent: ["GPTBot", "ChatGPT-User", "Google-Extended", "ClaudeBot", "PerplexityBot", "Bingbot"],
        allow: ["/", "/products/", "/categories/", "/collections/", "/blogs/", "/faq", "/about", "/dropshipping"],
        disallow: ["/admin/", "/client/", "/api/", "/checkout/"]
      }
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
