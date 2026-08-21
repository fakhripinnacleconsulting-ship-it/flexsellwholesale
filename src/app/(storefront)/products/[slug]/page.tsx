import * as React from "react";
import { productService } from "@/services/productService";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { constructMetadata, generateProductSchema, generateBreadcrumbSchema, generateOrganizationSchema } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

/**
 * Room for a cold on-demand render.
 *
 * A product added after the last deploy is not in `generateStaticParams`, so its first visitor
 * triggers generation: cold function, fresh Atlas connection, the product query and the
 * related-products query, then an ISR write. Measured at ~4.8s in production for the cheapest
 * possible miss. Under the platform default that render was being killed part-way, which is
 * what produced "A server error occurred" on every newly added product.
 *
 * This does not make the render faster — the warm-up in /api/products and the Suspense split
 * below do that. It stops a render that was going to succeed from being cut off.
 */
export const maxDuration = 60;

/**
 * Pre-build the most-visited product pages so crawler and user traffic lands on a warm
 * cache instead of triggering an on-demand render (each of which is an ISR write).
 *
 * Bounded to the newest 100: the long tail still renders on demand because
 * `dynamicParams` defaults to true.
 */
export async function generateStaticParams() {
  try {
    const dbConnect = (await import("@/lib/dbConnect")).default;
    const ProductModel = (await import("@/models/Product")).default;
    await dbConnect();
    const products = await ProductModel.find({ isActive: true })
      .select("_id")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<Array<{ _id: string }>>();
    // The route param keeps the name [slug] so the directory need not be renamed, but the
    // value prebuilt here is the id — the canonical form.
    return products.map((p) => ({ slug: String(p._id) }));
  } catch (err) {
    // Never fail the build on a DB hiccup — fall back to fully on-demand generation.
    console.error("generateStaticParams (products) notice:", (err as any)?.message || err);
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await productService.getProductBySlug(slug);
    const defaultVariant = product.colorVariants?.[0];
    const sku = defaultVariant?.subVariants?.[0]?.sku || "NO SKU";
    const firstImg = defaultVariant?.images?.[0];
    const imgUrl = firstImg ? (typeof firstImg === "string" ? firstImg : firstImg.url || "") : "";

    const title = product.seoTitle || `${product.title} - Factory Wholesale Price`;
    const description = product.seoDescription || `Buy ${product.title} at factory direct wholesale rates. SKU: ${sku}. ${product.description.slice(0, 150)}...`;
    const keywords = product.seoKeywords || product.tags?.join(", ") || `${product.title}, wholesale ${product.title}, bulk buy ${product.title}`;

    return constructMetadata({
      title,
      description,
      keywords,
      image: imgUrl,
      // Canonical is the id URL, so a slug visit and an id visit do not compete.
      path: `/products/${product._id}`,
    });
  } catch (error) {
    return constructMetadata({
      title: "Product Not Found",
      noIndex: true,
    });
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  let product;
  let products;

  /**
   * The fetch is caught; the redirect below is not.
   *
   * `permanentRedirect` signals by throwing a control-flow error. Calling it inside this
   * try/catch would have the catch swallow it and render the page at the wrong URL — so the
   * fetch assigns into outer variables rather than returning from inside the block.
   */
  try {
    [product, products] = await Promise.all([
      productService.getProductBySlug(slug),
      // Related-products strip only needs card fields. This used to pull 12 complete
      // documents — descriptions, A+ content blocks, every variant and image — and embed
      // them all in this page's RSC payload, which the browser must download before the
      // page can render on click.
      productService.getProducts({ limit: 12, listView: true })
    ]);
  } catch {
    return notFound();
  }

  /**
   * Send a slug visit to the id URL.
   *
   * 308 rather than 302 so search engines move ranking onto the id URL and stop crawling the
   * old one. Every previously indexed slug and every shared link keeps working — it just
   * lands one hop later.
   */
  if (slug !== product._id) {
    permanentRedirect(`/products/${product._id}`);
  }

  const productJsonLd = generateProductSchema(product, `/products/${product._id}`);
  const breadcrumbJsonLd = generateBreadcrumbSchema([
    { label: "Products", href: "/products" },
    { label: product.title, href: `/products/${product._id}` }
  ]);
  const orgJsonLd = generateOrganizationSchema();

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
      <ProductDetailView slug={product._id} initialProduct={product} initialProducts={products} />
    </>
  );
}
