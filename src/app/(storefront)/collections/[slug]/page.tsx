import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { collectionService } from "@/services/collectionService";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ExportCatalogButton } from "@/components/storefront/ExportCatalogButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Layers, AlertCircle, ShoppingBag } from "lucide-react";

export const revalidate = 3600; // ISR revalidation every hour

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const collection = await collectionService.getCollectionBySlug(slug);
    return {
      title: collection.seoTitle || `${collection.title} | Curated Wholesale Sourcing`,
      description: collection.seoDescription || collection.description || `Shop the ${collection.title} collection at direct wholesale prices.`,
      keywords: collection.seoKeywords || `${collection.title}, wholesale sourcing, bulk procurement, factory direct`,
    };
  } catch (err) {
    return {
      title: "Collection Sourcing Slabs | FlexSell Wholesale",
    };
  }
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function CollectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let collection;
  let products = [];

  try {
    collection = await collectionService.getCollectionBySlug(slug);
    if (!collection || !collection.isActive) {
      return notFound();
    }
    products = await collectionService.getCollectionProducts(collection._id);
  } catch (err) {
    console.error("Error loading collection details", err);
    return notFound();
  }

  // Define breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Collections", href: "/collections" },
    { label: toTitleCase(collection.title) }
  ];

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-6 md:py-10 text-foreground select-none">
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Collection Hero Header */}
      <div className="relative border border-border bg-card rounded-3xl overflow-hidden shadow-md mb-10 min-h-[300px] md:min-h-[420px] flex flex-col justify-center">
        {/* Banner image or fallback premium gradient */}
        {collection.bannerImage ? (
          <div className="absolute inset-0 z-0 bg-secondary">
            <img
              src={collection.bannerImage}
              alt={collection.title}
              className="absolute inset-0 w-full h-full object-cover brightness-[0.7] saturate-[1.1] scale-100 group-hover:scale-105 transition-transform duration-700"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-background/95 via-background/60 to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-secondary/50 via-background to-secondary/30">
            {/* Glowing ambient light blobs for premium fallback */}
            <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />
          </div>
        )}

        {/* Content Overlay - Floating Glass Card */}
        <div className="relative z-10 p-6 md:p-12 max-w-4xl w-full">
          <div className="bg-background/70 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20 mb-3.5">
              <Layers className="h-3.5 w-3.5" />
              {collection.type === "smart" ? "Automated Sourcing" : "Hand-Curated Catalog"}
            </span>
            
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
              {toTitleCase(collection.title)}
            </h1>

            {collection.description && (
              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed font-semibold mt-3">
                {collection.description}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-muted-foreground mt-4 pt-3 border-t border-border/40">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>Showing {products.length} {products.length === 1 ? "factory line" : "factory lines"}</span>
              </div>
              <ExportCatalogButton 
                products={products} 
                catalogTitle={`${toTitleCase(collection.title)} Collection`} 
                filterSummary={`Collection: ${toTitleCase(collection.title)}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {products.length === 0 ? (
        <div className="text-center py-24 border border-dashed rounded-3xl bg-secondary/5">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-bold text-foreground">No Products Found</p>
          <p className="text-xs text-muted-foreground mt-1">This collection does not contain any catalog lines at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {products.map((product: any) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
