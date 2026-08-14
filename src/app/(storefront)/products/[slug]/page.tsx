import * as React from "react";
import { productService } from "@/services/productService";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { constructMetadata, generateProductSchema, generateBreadcrumbSchema, generateOrganizationSchema } from "@/lib/seo";

export const revalidate = 86400; // 24h safety net; freshness comes from on-demand revalidation (lib/revalidate.ts)

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
      .select("slug")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean<Array<{ slug: string }>>();
    return products.map((p) => ({ slug: p.slug }));
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
      path: `/products/${product.slug}`,
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
  
  try {
    const [product, products] = await Promise.all([
      productService.getProductBySlug(slug),
      // Related-products strip only needs card fields. This used to pull 12 complete
      // documents — descriptions, A+ content blocks, every variant and image — and embed
      // them all in this page's RSC payload, which the browser must download before the
      // page can render on click.
      productService.getProducts({ limit: 12, listView: true })
    ]);

    const productJsonLd = generateProductSchema(product, `/products/${product.slug}`);
    const breadcrumbJsonLd = generateBreadcrumbSchema([
      { label: "Products", href: "/products" },
      { label: product.title, href: `/products/${product.slug}` }
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
        <ProductDetailView slug={slug} initialProduct={product} initialProducts={products} />
      </>
    );
  } catch (error) {
    return notFound();
  }
}
