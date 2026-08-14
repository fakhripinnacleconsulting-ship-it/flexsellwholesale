"use client";

import * as React from "react";
import Image from "next/image";

export interface BrandPartner {
  name: string;
  logoUrl: string;
  websiteUrl?: string;
}

interface BrandPartnersBarProps {
  partners?: BrandPartner[];
}

export function BrandPartnersBar({ partners }: BrandPartnersBarProps) {
  if (!partners || partners.length === 0) return null;

  // Repeat for smooth infinite marquee
  const items = Array(4).fill(partners).flat();

  const renderPartner = (partner: BrandPartner, idx: number, group: number) => {
    const content = (
      <>
        <div className="h-12 w-28 sm:h-14 sm:w-36 relative transition-transform duration-500 group-hover:scale-110 drop-shadow-sm">
          <Image
            src={partner.logoUrl}
            alt={partner.name}
            fill
            sizes="(max-width: 640px) 112px, 144px"
            className="object-contain"
          />
        </div>
        <span className="text-[10px] sm:text-xs font-bold tracking-widest text-foreground/80 uppercase group-hover:text-primary transition-colors">
          {partner.name}
        </span>
      </>
    );

    const className = "flex flex-col items-center justify-center gap-3 group";

    if (partner.websiteUrl) {
      return (
        <a 
          key={`partner-${group}-${idx}`} 
          href={partner.websiteUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={className}
        >
          {content}
        </a>
      );
    }

    return (
      <div key={`partner-${group}-${idx}`} className={className}>
        {content}
      </div>
    );
  };

  return (
    <section className="py-10 bg-gradient-to-b from-secondary/5 to-secondary/20 border-y border-border/50 overflow-hidden select-none w-full">
      <div className="mx-auto max-w-8xl px-4 md:px-6 mb-8 text-center">
        <h2 className="text-sm sm:text-base font-black uppercase tracking-[0.2em] text-foreground/80">
          Trusted Factory & Sourcing Partners
        </h2>
        <div className="w-16 h-1 bg-primary/40 mx-auto mt-3 rounded-full" />
      </div>
      <div className="flex w-max whitespace-nowrap animate-marquee pause-marquee transition-all">
        <div className="flex items-center gap-10 sm:gap-16 px-5 sm:px-8">
          {items.map((partner, idx) => renderPartner(partner, idx, 1))}
        </div>
        <div className="flex items-center gap-10 sm:gap-16 px-5 sm:px-8">
          {items.map((partner, idx) => renderPartner(partner, idx, 2))}
        </div>
      </div>
    </section>
  );
}
