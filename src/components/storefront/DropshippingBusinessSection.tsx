"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Package, TrendingUp, Zap, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export interface DropshipCardItem {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
}

export interface DropshipBusinessData {
  heading?: string;
  subheading?: string;
  cards?: DropshipCardItem[];
  ctaText?: string;
  ctaLink?: string;
}

interface DropshippingBusinessSectionProps {
  data?: DropshipBusinessData;
}

export function DropshippingBusinessSection({ data }: DropshippingBusinessSectionProps) {
  const heading = data?.heading || "Automated Dropshipping Partner Program";
  const subheading = data?.subheading || "Sell retail online without stocking inventory. We store, quality check, and white-label dispatch directly to your end buyers.";
  const ctaText = data?.ctaText || "Apply for Dropshipper Access & API";
  const ctaLink = data?.ctaLink || "/dropshipping";

  const defaultCards: DropshipCardItem[] = [
    { icon: "package", title: "Zero Inventory Investment", desc: "No upfront capital needed. We manage warehousing and stock holding for over 5,000+ utility SKUs.", badge: "Risk-Free Business" },
    { icon: "trending-up", title: "30-50% Profit Margins", desc: "Access specialized dropshipping tier pricing to keep high retail markups on every Shopify/WooCommerce order.", badge: "High Retail Profits" },
    { icon: "zap", title: "24-48 hr White-Label Dispatch", desc: "Boxes shipped directly to your customer with your store brand label. No FlexSell branding inside.", badge: "White-Label Box" },
    { icon: "shield", title: "Automated Wallet & API Sync", desc: "Auto-sync products, top-up account wallet balance, and retrieve courier tracking IDs in bulk.", badge: "Instant Tracking Sync" }
  ];

  const cards = data?.cards && data.cards.length > 0 ? data.cards : defaultCards;

  const getCardIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "package":
        return <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />;
      case "trending-up":
      case "margin":
        return <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />;
      case "zap":
      case "shipping":
        return <Zap className="h-6 w-6 text-purple-600 dark:text-purple-400" />;
      default:
        return <ShieldCheck className="h-6 w-6 text-purple-600 dark:text-purple-400" />;
    }
  };

  return (
    <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-background to-background p-8 md:p-12 shadow-lg space-y-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-500/20 pb-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Independent Dropshipping Channel
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
            <Button size="lg" className="font-bold shadow-md gap-2 shrink-0 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer">
              {ctaText} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((item, idx) => (
            <div key={idx} className="p-5 bg-card border border-border rounded-xl space-y-3 hover:border-purple-500/40 hover:shadow-md transition-all">
              <div className="flex justify-between items-center">
                <div className="p-2.5 bg-purple-500/10 rounded-lg">
                  {getCardIcon(item.icon)}
                </div>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
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
