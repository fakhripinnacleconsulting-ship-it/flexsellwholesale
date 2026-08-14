"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/stores/authStore";
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
  const router = useRouter();
  const customer = useAuthStore((state: any) => state.customer);

  const heading = data?.heading || "Automated Dropshipping Program";
  const subheading = data?.subheading || "Sell online without buying or storing stock. We hold inventory in our Bhopal warehouse, pack orders with your brand label, and ship direct to your customers.";
  
  // Clean CTA text to ensure "& API" is removed
  const rawCtaText = data?.ctaText || "Apply for Dropshipper Access";
  const ctaText = rawCtaText.replace(/\s*&\s*API/gi, "").trim() || "Apply for Dropshipper Access";

  const defaultCards: DropshipCardItem[] = [
    { icon: "package", title: "Zero Stock Investment", desc: "No upfront money needed. Sell 5,000+ items stored in our central Bhopal facility.", badge: "Zero Risk" },
    { icon: "trending-up", title: "High Retail Profits", desc: "Get special dropshipping prices so you earn strong profit margins on every customer order.", badge: "Good Profits" },
    { icon: "zap", title: "24-48 Hr Fast Packing", desc: "Parcels shipped directly to your customer with your store brand label. No FlexSell name inside.", badge: "White-Label Box" },
    { icon: "shield", title: "Easy Wallet & Order Sync", desc: "Easily sync items, add wallet funds, and get tracking numbers instantly.", badge: "Auto Sync" }
  ];

  const cards = data?.cards && data.cards.length > 0 ? data.cards : defaultCards;

  const handleApplyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (customer) {
      router.push("/dropshipping");
    } else {
      router.push("/register");
    }
  };

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

          <Button 
            size="lg" 
            onClick={handleApplyClick}
            className="w-full sm:w-auto font-extrabold shadow-md gap-2 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer text-xs sm:text-sm px-4 sm:px-6 py-3 rounded-xl flex items-center justify-center text-center leading-snug whitespace-normal sm:whitespace-nowrap"
          >
            <span>{ctaText}</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </Button>
        </div>

        <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-6 sm:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {cards.map((item, idx) => (
            <div key={idx} className="min-w-[260px] max-w-[260px] sm:min-w-0 sm:max-w-none flex-shrink-0 snap-center p-5 bg-card border border-border rounded-xl space-y-3 hover:border-purple-500/40 hover:shadow-md transition-all">
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
