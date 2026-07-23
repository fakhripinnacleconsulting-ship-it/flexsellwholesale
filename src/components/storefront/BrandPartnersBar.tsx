"use client";

import * as React from "react";
import Image from "next/image";

export interface BrandPartner {
  name: string;
  logoUrl: string;
}

interface BrandPartnersBarProps {
  partners?: BrandPartner[];
}

export function BrandPartnersBar({ partners }: BrandPartnersBarProps) {
  if (!partners || partners.length === 0) return null;

  // Repeat for smooth infinite marquee
  const items = Array(4).fill(partners).flat();

  return (
    <section className="py-8 bg-secondary/10 border-y border-border/50 overflow-hidden select-none w-full">
      <div className="mx-auto max-w-8xl px-4 md:px-6 mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Trusted Factory & Sourcing Partners
        </p>
      </div>
      <div className="flex w-max whitespace-nowrap animate-marquee pause-marquee">
        <div className="flex items-center gap-12 px-6">
          {items.map((partner, idx) => (
            <div key={`partner-1-${idx}`} className="h-10 w-32 relative grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100 flex items-center justify-center">
              <Image
                src={partner.logoUrl}
                alt={partner.name}
                fill
                sizes="128px"
                className="object-contain"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-12 px-6">
          {items.map((partner, idx) => (
            <div key={`partner-2-${idx}`} className="h-10 w-32 relative grayscale hover:grayscale-0 transition-all opacity-70 hover:opacity-100 flex items-center justify-center">
              <Image
                src={partner.logoUrl}
                alt={partner.name}
                fill
                sizes="128px"
                className="object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
