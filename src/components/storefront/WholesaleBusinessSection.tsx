"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { BadgePercent, ShieldCheck, Truck, FileText, ArrowRight, Building2 } from "lucide-react";
import { motion } from "framer-motion";

export interface WholesaleCardItem {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
}

export interface WholesaleBusinessData {
  heading?: string;
  subheading?: string;
  cards?: WholesaleCardItem[];
  ctaText?: string;
  ctaLink?: string;
}

interface WholesaleBusinessSectionProps {
  data?: WholesaleBusinessData;
}

export function WholesaleBusinessSection({ data }: WholesaleBusinessSectionProps) {
  const heading = data?.heading || "Factory Direct B2B Wholesale Sourcing";
  const subheading = data?.subheading || "Direct importer container cargo prices for Indian shop owners, resellers, and commercial bulk buyers.";
  const ctaText = data?.ctaText || "Explore Wholesale Catalog & Get Quotes";
  const ctaLink = data?.ctaLink || "/products";

  const defaultCards: WholesaleCardItem[] = [
    { icon: "price", title: "Direct Factory Prices", desc: "No middle-man wholesalers. Container-loads imported directly from global manufacturers to give you up to 40% higher retail margins.", badge: "Lowest Price Guaranteed" },
    { icon: "quality", title: "Rigorous Quality Line", desc: "Dedicated sorting and packaging line checking electricals, plastic grades, and silicon seals before dispatch.", badge: "Tested & Approved" },
    { icon: "shipping", title: "Express Freight Cargo", desc: "Partnership with Delhivery, Gati, and V-Trans for safe, fast ground heavy shipment delivery.", badge: "Surat Logistics Hub" },
    { icon: "invoice", title: "Instant GST ITC Invoicing", desc: "Automated GST invoices generated during checkout to claim your full Input Tax Credit.", badge: "100% Tax Compliant" }
  ];

  const cards = data?.cards && data.cards.length > 0 ? data.cards : defaultCards;

  const getCardIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "price":
        return <BadgePercent className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
      case "quality":
        return <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
      case "shipping":
        return <Truck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
      case "invoice":
        return <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  return (
    <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-background to-background p-8 md:p-12 shadow-lg space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-500/20 pb-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider">
                Independent B2B Sourcing Channel
              </span>
            </div>
            <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {heading}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
              {subheading}
            </p>
          </div>

          <Link href={ctaLink}>
            <Button size="lg" className="font-bold shadow-md gap-2 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer">
              {ctaText} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((item, idx) => (
            <div key={idx} className="p-5 bg-card border border-border rounded-xl space-y-3 hover:border-emerald-500/40 hover:shadow-md transition-all">
              <div className="flex justify-between items-center">
                <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                  {getCardIcon(item.icon)}
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {item.badge}
                  </span>
                )}
              </div>
              <h3 className="font-bold text-base text-foreground">{item.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
