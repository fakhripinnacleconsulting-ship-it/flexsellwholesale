"use client";

import * as React from "react";
import { Package, Truck, MapPin, Users, Award, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export interface TrustStatItem {
  icon: string;
  count: string;
  label: string;
}

interface TrustBarProps {
  stats?: TrustStatItem[];
}

export function TrustBar({ stats }: TrustBarProps) {
  const defaultStats: TrustStatItem[] = [
    { icon: "package", count: "5,000+", label: "Products Listed" },
    { icon: "truck", count: "10,000+", label: "Orders Shipped" },
    { icon: "map-pin", count: "500+", label: "Cities Covered" },
    { icon: "users", count: "2,000+", label: "Active Buyers" }
  ];

  const activeStats = stats && stats.length > 0 ? stats : defaultStats;

  const getStatIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case "package":
        return <Package className="h-7 w-7 text-primary" />;
      case "truck":
        return <Truck className="h-7 w-7 text-primary" />;
      case "map-pin":
      case "map":
        return <MapPin className="h-7 w-7 text-primary" />;
      case "users":
        return <Users className="h-7 w-7 text-primary" />;
      case "award":
        return <Award className="h-7 w-7 text-primary" />;
      default:
        return <ShieldCheck className="h-7 w-7 text-primary" />;
    }
  };

  return (
    <section className="mx-auto max-w-8xl px-4 md:px-6 w-full py-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {activeStats.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.1 }}
            className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-sm hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="p-3 bg-primary/10 rounded-xl flex-shrink-0">
              {getStatIcon(item.icon)}
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-foreground tracking-tight">{item.count}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
