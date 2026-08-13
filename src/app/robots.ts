import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  // Shared normalised origin — guarantees https and no trailing slash (see lib/seo.ts).
  const baseUrl = SITE_URL;

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
          "/system-diagnostics/",
          // Faceted filter permutations render the same products under near-infinite
          // URLs. Crawling them burns crawl budget and Edge Requests for no index value.
          "/search",
          "/*?*categories=",
          "/*?*subcategories=",
          "/*?*minPrice=",
          "/*?*maxPrice=",
          "/*?*minDiscount=",
          "/*?*inStock=",
          "/*?*sort="
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
