"use client";

import * as React from "react";
import Link from "next/link";
import { Collection } from "@/types";
import { CollectionCard } from "./CollectionCard";
import { Layers } from "lucide-react";

interface FeaturedCollectionsProps {
  collections: Collection[];
  productCounts: Record<string, number>;
}

export function FeaturedCollections({ collections, productCounts }: FeaturedCollectionsProps) {
  const featured = collections.filter(c => c.isActive && c.isFeatured).slice(0, 4);

  if (featured.length === 0) return null;

  return (
    <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4 select-none">
      <div className="flex justify-between items-end mb-8 border-b pb-4 border-border/60">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            Curated B2B Sourcing Lines
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Factory direct supply chains categorized for optimal bulk inventory procurement.
          </p>
        </div>
        <Link href="/collections" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
          All Sourcing Collections &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {featured.map((collection) => (
          <CollectionCard
            key={collection._id}
            collection={collection}
            productCount={productCounts[collection._id] || 0}
          />
        ))}
      </div>
    </section>
  );
}
