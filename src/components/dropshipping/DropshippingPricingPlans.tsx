"use client";

import React from "react";
import { Check, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { motion } from "framer-motion";
import { DropshippingCMSData, DropshippingPlan } from "@/lib/seedDropshippingCMS";
import { formatPrice } from "@/lib/utils";

interface DropshippingPricingPlansProps {
  data?: DropshippingCMSData["pricing"];
  heading?: string;
  subheading?: string;
  bannerImage?: string;
  plans?: DropshippingPlan[];
  categories?: string[];
  onSelectPlan?: (planName: string) => void;
}

export function DropshippingPricingPlans(props: DropshippingPricingPlansProps) {
  const heading = props.data?.heading || props.heading || "MEMBERSHIP PLAN & PRICING";
  const subheading =
    props.data?.subheading || props.subheading || "GOLD MEMBERSHIP PLAN — COMPLETE AUTOMATED FULFILLMENT";
  const bannerImage = props.data?.bannerImage || props.bannerImage || "/images/dropshipping/image7.jpeg";
  const plans = props.data?.plans || props.plans || [];
  const categories = props.data?.categories || props.categories || [];

  return (
    <section id="pricing" className="py-16 md:py-24 bg-white dark:bg-slate-950 px-4 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800 relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Subscription Pricing</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {heading}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">
            {subheading}
          </p>
        </motion.div>

        {/* Gold Membership Graphic Banner Card from DOCX */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          whileHover={{ scale: 1.01 }}
          className="max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-purple-500/30 bg-slate-900 relative group cursor-pointer"
        >
          <img
            src={bannerImage}
            alt="Gold Membership Plan Illustration"
            className="w-full h-auto object-cover max-h-[460px] transform group-hover:scale-102 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold bg-purple-600/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg">
              Gold Partner Plan Overview
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards Flex Container (Auto-Centered based on card count) */}
        <div className="flex flex-wrap justify-center items-stretch gap-8 max-w-5xl mx-auto">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id || idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              whileHover={{ y: -8 }}
              className="w-full md:w-[calc(50%-1rem)] max-w-md relative rounded-3xl p-8 bg-gradient-to-b from-purple-950/90 to-slate-900 border-2 border-purple-500 shadow-2xl text-white flex flex-col justify-between"
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs uppercase px-4 py-1.5 rounded-full shadow-md tracking-wider">
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 className="text-2xl font-black mb-2">{plan.name}</h3>
                <p className="text-xs text-slate-300 mb-6">{plan.description}</p>

                {/* Options List (3 Months vs 6 Months) */}
                <div className="space-y-3 mb-8">
                  {plan.options?.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                        opt.popular
                          ? "bg-purple-500/20 border-purple-400/60 shadow-md"
                          : "bg-slate-800/60 border-slate-700/60"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold">{opt.duration}</div>
                        {opt.originalPrice && (
                          <span className="text-xs text-slate-400 line-through mr-2">
                            {formatPrice(opt.originalPrice)}
                          </span>
                        )}
                      </div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-400">
                        {formatPrice(opt.price)}
                      </div>
                    </div>
                  ))}
                </div>

                <ul className="space-y-3.5 mb-8">
                  {plan.features?.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-sm">
                      <div className="p-1 rounded-full bg-purple-500/20 text-purple-300 mt-0.5 shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-slate-200">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => props.onSelectPlan?.(plan.name)}
                className="w-full py-4 font-bold rounded-2xl text-base bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-lg shadow-purple-900/40 cursor-pointer"
              >
                Select {plan.name}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Supported Categories Pills */}
        {categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto text-center shadow-xs"
          >
            <div className="flex items-center justify-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 font-bold text-sm uppercase tracking-wider">
              <Layers className="w-4 h-4" />
              <span>Supported Amazon Fast-Selling Categories</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              {categories.map((cat, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200 shadow-xs"
                >
                  {cat}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
