"use client";

import React, { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";

interface DropshippingTermsAccordionProps {
  data: DropshippingCMSData["terms"];
}

export function DropshippingTermsAccordion({ data }: DropshippingTermsAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!data) return null;

  const toggleIndex = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16 md:py-20 bg-slate-50 dark:bg-slate-900/60 px-4 sm:px-6 lg:px-8 border-b border-border/40">
      <div className="max-w-4xl mx-auto space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>Policy Guidelines</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.heading || "FLEXSELL WHOLESALE DROPSHIPPING TERMS & CONDITIONS"}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">
            {data.subheading}
          </p>
        </motion.div>

        <div className="space-y-3">
          {data.sections?.map((section, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all"
              >
                <button
                  onClick={() => toggleIndex(idx)}
                  className="w-full py-4 px-6 text-left flex items-center justify-between gap-4 font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm sm:text-base cursor-pointer"
                >
                  <span>{section.title}</span>
                  <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="px-6 pb-5 pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800/60 leading-relaxed space-y-2"
                    >
                      {section.points?.map((point, pIdx) => (
                        <p key={pIdx}>• {point}</p>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
