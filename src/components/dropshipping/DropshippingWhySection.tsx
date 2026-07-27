"use client";

import React from "react";
import {
  DollarSign,
  PackageCheck,
  TrendingUp,
  Building2,
  Truck,
  ShieldCheck,
  Search,
  Box,
  Warehouse,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";

interface DropshippingWhySectionProps {
  data: DropshippingCMSData["whyFlexsell"];
}

const ICON_MAP: Record<string, React.ElementType> = {
  dollar: DollarSign,
  box: Box,
  search: Search,
  warehouse: Warehouse,
  truck: Truck,
  shield: ShieldCheck,
  DollarSign,
  PackageCheck,
  TrendingUp,
  Building2,
  TruckIcon: Truck,
  ShieldCheck,
};

export function DropshippingWhySection({ data }: DropshippingWhySectionProps) {
  const bannerImage = data?.bannerImage || "/images/dropshipping/image2.png";

  return (
    <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/60 px-4 sm:px-6 lg:px-8 border-b border-border/40 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Why Choose FlexSell Dropshipping</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data?.heading || "Why Thousands of Sellers Are Moving Towards Smarter Selling"}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed">
            {data?.subheading ||
              "FlexSell provides a turnkey solution that handles inventory, catalog research, warehousing, and order fulfillment directly from our Bhopal hub."}
          </p>
        </motion.div>

        {/* Banner Graphic Card with Motion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          whileHover={{ scale: 1.01 }}
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-emerald-500/20 bg-slate-900 relative group cursor-pointer"
        >
          <img
            src={bannerImage}
            alt="Why Choose FlexSell Dropshipping Model"
            className="w-full h-auto object-cover max-h-[480px] transform group-hover:scale-103 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold bg-emerald-600/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg">
              Smarter Amazon Selling Model 2026
            </span>
            <span className="text-xs text-slate-300 hidden sm:inline-block">
              Bhopal 40,000 Sq Ft Warehousing Facility
            </span>
          </div>
        </motion.div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {data?.benefits?.map((benefit, index) => {
            const IconComponent = ICON_MAP[benefit.icon] || ShieldCheck;
            const cardImg =
              benefit.image ||
              (index === 0
                ? "/images/dropshipping/image27.jpeg"
                : index === 1
                  ? "/images/dropshipping/image26.jpeg"
                  : index === 4
                    ? "/images/dropshipping/image33.jpeg"
                    : index === 5
                      ? "/images/dropshipping/image47.jpeg"
                      : undefined);

            return (
              <motion.div
                key={benefit.id || index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300/40 dark:border-emerald-700/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shadow-xs">
                      <IconComponent className="w-6 h-6" />
                    </div>

                    {cardImg && (
                      <div className="w-20 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs group-hover:scale-105 transition-transform">
                        <img src={cardImg} alt={benefit.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-3 leading-snug">
                    {benefit.title}
                  </h3>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
