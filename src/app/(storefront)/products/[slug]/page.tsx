import * as React from "react";
import { productService } from "@/services/productService";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { constructMetadata, generateProductSchema, generateBreadcrumbSchema, generateOrganizationSchema } from "@/lib/seo";

export const revalidate = 60;

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
      productService.getProducts({ limit: 12 })
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
        <ProductDetailView slug={slug} initialProducts={products} />
      </>
    );
  } catch (error) {
    return notFound();
  }
}
