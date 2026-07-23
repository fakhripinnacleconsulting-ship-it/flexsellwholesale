import * as React from "react";
import { collectionService } from "@/services/collectionService";
import { CollectionCard } from "@/components/storefront/CollectionCard";
import { Layers } from "lucide-react";

export const revalidate = 3600; // ISR revalidation every hour

export default async function CollectionsPage() {
  const collections = await collectionService.getCollections();
  const activeCollections = collections.filter(c => c.isActive);

  const productCounts: Record<string, number> = {};
  for (const col of activeCollections) {
    try {
      const colProducts = await collectionService.getCollectionProducts(col._id);
      productCounts[col._id] = colProducts.length;
    } catch (err) {
      console.error(`Failed to load product count for collection ${col._id}`, err);
      productCounts[col._id] = 0;
    }
  }

  return (
    <div className="mx-auto max-w-8xl px-4 md:px-6 py-12 text-foreground w-full select-none">
      <div className="mb-10 text-center sm:text-left border-b pb-6 border-border/60">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl flex items-center gap-2 justify-center sm:justify-start">
          <Layers className="h-8 w-8 text-primary" />
          Product Sourcing Collections
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Browse our curated catalog segments. Grouped by product category, tax exemptions, and customized supplier logistics.
        </p>
      </div>

      {activeCollections.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-2xl bg-secondary/5">
          <Layers className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-bold text-foreground">No active collections found.</p>
          <p className="text-xs text-muted-foreground mt-1">Please check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {activeCollections.map((collection) => (
            <CollectionCard
              key={collection._id}
              collection={collection}
              productCount={productCounts[collection._id] || 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
