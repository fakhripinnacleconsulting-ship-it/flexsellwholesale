import { MetadataRoute } from "next";
import { productService } from "@/services/productService";
import { categoryService } from "@/services/categoryService";
import { collectionService } from "@/services/collectionService";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://flexsellwholesale.in";

  // Static Core Landing Pages
  const staticRoutes = [
    "",
    "/products",
    "/about",
    "/contact",
    "/faq",
    "/dropshipping",
    "/blogs",
    "/policies/shipping-policy",
    "/policies/privacy-policy",
    "/policies/terms-of-service",
    "/policies/return-policy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" || route === "/products" ? ("daily" as const) : ("weekly" as const),
    priority: route === "" ? 1.0 : route === "/products" ? 0.9 : 0.8,
  }));

  try {
    // Dynamic products routes
    const products = await productService.getProducts();
    const productRoutes = products.map((product) => ({
      url: `${baseUrl}/products/${product.slug}`,
      lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    // Dynamic categories routes
    const categories = await categoryService.getCategories();
    const categoryRoutes = categories.map((category) => ({
      url: `${baseUrl}/categories/${category.slug}`,
      lastModified: category.updatedAt ? new Date(category.updatedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // Dynamic collections routes
    const collections = await collectionService.getCollections();
    const collectionRoutes = collections
      .filter((c) => c.isActive)
      .map((collection) => ({
        url: `${baseUrl}/collections/${collection.slug}`,
        lastModified: collection.updatedAt ? new Date(collection.updatedAt) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));

    // Dynamic blogs routes
    let blogRoutes: MetadataRoute.Sitemap = [];
    try {
      const dbConnect = (await import("@/lib/dbConnect")).default;
      const CmsContent = (await import("@/models/CmsContent")).default;
      await dbConnect();
      const cmsBlogsDoc = await CmsContent.findOne({ key: "blogs" }).lean();
      if (cmsBlogsDoc?.value && Array.isArray(cmsBlogsDoc.value)) {
        blogRoutes = cmsBlogsDoc.value
          .filter((b: any) => b.isActive !== false && b.slug)
          .map((b: any) => ({
            url: `${baseUrl}/blogs/${b.slug}`,
            lastModified: b.publishedAt ? new Date(b.publishedAt) : new Date(),
            changeFrequency: "weekly" as const,
            priority: 0.7,
          }));
      }
    } catch (err) {
      console.error("Sitemap blog fetch notice:", err);
    }

    return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...collectionRoutes, ...blogRoutes];
  } catch (error) {
    console.error("Sitemap generation error, falling back to static routes:", error);
    return staticRoutes;
  }
}
