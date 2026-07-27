"use client";

import React from "react";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";
import { UserCheck, ListPlus, ShoppingBag, CreditCard, Send, Workflow } from "lucide-react";
import { motion } from "framer-motion";

interface DropshippingHowItWorksProps {
  data: DropshippingCMSData["howItWorks"];
}

const STEP_ICONS = [UserCheck, ListPlus, ShoppingBag, CreditCard, Send];

export function DropshippingHowItWorks({ data }: DropshippingHowItWorksProps) {
  const processImage = data?.processImage || "/images/dropshipping/image3.png";

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-slate-950 px-4 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider">
            <Workflow className="w-4 h-4 text-blue-500" />
            <span>{data?.tagline || "5 SIMPLE STEPS TO SCALE YOUR AMAZON BUSINESS"}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data?.heading || "How FlexSell Dropshipping Works"}
          </h2>
        </motion.div>

        {/* Workflow Process Graphic Card with Motion */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          whileHover={{ scale: 1.01 }}
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-blue-500/20 bg-slate-900 relative group cursor-pointer"
        >
          <img
            src={processImage}
            alt="How FlexSell Dropshipping Works Workflow"
            className="w-full h-auto object-cover max-h-[480px] transform group-hover:scale-103 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold bg-blue-600/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg">
              Automated 5-Step Order Dispatch Pipeline
            </span>
          </div>
        </motion.div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
          {data?.steps?.map((stepItem, index) => {
            const Icon = STEP_ICONS[index] || Send;
            return (
              <motion.div
                key={stepItem.stepNumber || index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.12 }}
                whileHover={{ y: -8, scale: 1.03 }}
                className="relative bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-left flex flex-col justify-between shadow-xs hover:border-emerald-500/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div>
                  {/* Step Number Badge */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="w-10 h-10 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm flex items-center justify-center shadow-md">
                      0{stepItem.stepNumber}
                    </span>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-300/30">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  {stepItem.badge && (
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2 block">
                      {stepItem.badge}
                    </span>
                  )}

                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                    {stepItem.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {stepItem.description}
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
