"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Package, TrendingUp, Zap, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export interface DropshipFeature {
  icon: string;
  title: string;
  desc: string;
}

export interface DropshipPromoData {
  heading?: string;
  subheading?: string;
  ctaText?: string;
  ctaLink?: string;
  features?: DropshipFeature[];
}

interface DropshippingPromoProps {
  data?: DropshipPromoData;
}

export function DropshippingPromo({ data }: DropshippingPromoProps) {
  const [promoData, setPromoData] = React.useState<DropshipPromoData | undefined>(data);

  React.useEffect(() => {
    if (!data) {
      fetch("/api/cms")
        .then((res) => res.json())
        .then((cms) => {
          if (cms.dropshipping_promo) setPromoData(cms.dropshipping_promo);
        })
        .catch((err) => console.error("Failed to load dropship promo:", err));
    }
  }, [data]);

  const activeData = promoData || data;
  if (!activeData) return null;

  const heading = activeData.heading || "Start Your B2B Dropshipping Business";
  const subheading = activeData.subheading || "Zero inventory risk. Ship directly to your retail buyers straight from our 40,000 sq ft Surat logistics hub.";
  const ctaText = activeData.ctaText || "Explore Dropshipping Program & Register";
  const ctaLink = activeData.ctaLink || "/dropshipping";
  const features = activeData.features || [];

  const getFeatureIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "package":
        return <Package className="h-6 w-6 text-primary" />;
      case "trending-up":
      case "margin":
        return <TrendingUp className="h-6 w-6 text-primary" />;
      case "zap":
      case "shipping":
        return <Zap className="h-6 w-6 text-primary" />;
      default:
        return <ShieldCheck className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8 md:p-10 shadow-md space-y-6"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              {heading}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {subheading}
            </p>
          </div>

          <Link href={ctaLink}>
            <Button size="lg" className="font-bold shadow-md gap-2 shrink-0 cursor-pointer">
              {ctaText} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {features.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-primary/10 pt-6">
            {features.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 bg-card/60 rounded-xl border border-border/50">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  {getFeatureIcon(item.icon)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </section>
  );
}
