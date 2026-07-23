"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Collection } from "@/types";
import { Card } from "@/components/ui/Card";
import { ArrowRight, Layers } from "lucide-react";

interface CollectionCardProps {
  collection: Collection;
  productCount?: number;
}

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function CollectionCard({ collection, productCount = 0 }: CollectionCardProps) {
  const formattedTitle = toTitleCase(collection.title);

  return (
    <Link href={`/collections/${collection.slug}`} className="block h-full group">
      <Card className="relative overflow-hidden h-full flex flex-col justify-end min-h-[340px] border border-border bg-card hover:border-primary/50 transition-all duration-500 shadow-sm hover:shadow-xl group rounded-2xl">
        
        {/* Background Image / Placeholder */}
        <div className="absolute inset-0 bg-secondary overflow-hidden z-0">
          <img
            src={collection.image || `https://placehold.co/600x400/10b981/ffffff?text=${encodeURIComponent(formattedTitle)}`}
            alt={formattedTitle}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 brightness-[0.8] group-hover:brightness-[0.7]"
            loading="lazy"
          />
        </div>

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent z-10 transition-colors duration-500" />

        {/* Card Content */}
        <div className="p-6 relative z-20 flex flex-col space-y-2 mt-auto">
          {/* Metadata badges */}
          <div className="flex justify-between items-center">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-primary bg-primary/10 backdrop-blur-md px-2.5 py-1 rounded-full">
              <Layers className="h-3 w-3" />
              {collection.type === "smart" ? "Automated" : "Curated"}
            </span>
            <span className="text-[10px] font-black text-primary/95 bg-background/80 backdrop-blur-sm border px-2 py-0.5 rounded-md">
              {productCount} {productCount === 1 ? "Product" : "Products"}
            </span>
          </div>

          <h3 className="text-lg md:text-xl font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-1">
            {formattedTitle}
          </h3>

          {collection.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed font-medium">
              {collection.description}
            </p>
          )}

          {/* CTA Link */}
          <div className="pt-2 flex items-center gap-1.5 text-xs font-bold text-primary group-hover:translate-x-1 transition-transform duration-300">
            <span>Explore Collection</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
