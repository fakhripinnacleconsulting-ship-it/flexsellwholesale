"use client";

import React from "react";
import { CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";

interface DropshippingComparisonTableProps {
  data: DropshippingCMSData["comparison"];
}

export function DropshippingComparisonTable({ data }: DropshippingComparisonTableProps) {
  const matrixImage = data?.matrixImage || "/images/dropshipping/image4.png";

  return (
    <section className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900/60 px-4 sm:px-6 lg:px-8 border-b border-border/40 relative">
      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 text-xs font-black uppercase tracking-wider">
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span>{data?.tagline || "SMARTER SELLING MODEL FOR AMAZON GROWTH"}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data?.heading || "TRADITIONAL AMAZON BUSINESS VS FLEXSELL WHOLESALE"}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg">
            {data?.subheading || "TRADITIONAL MODEL VS FLEXSELL MODEL"}
          </p>
        </div>

        {/* Comparison Graphic Showcase Card from DOCX */}
        <div className="max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-purple-500/20 bg-slate-900 relative group">
          <img
            src={matrixImage}
            alt="Traditional Amazon vs FlexSell Comparison Matrix"
            className="w-full h-auto object-cover max-h-[480px] transform group-hover:scale-102 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
            <span className="text-xs sm:text-sm font-bold bg-purple-600/90 backdrop-blur-md px-4 py-1.5 rounded-full shadow-lg">
              Operational Feature Comparison Matrix
            </span>
          </div>
        </div>

        {/* Comparison Table Container */}
        <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80">
                <th className="py-4 px-6 text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider w-1/3">
                  Operational Feature
                </th>
                <th className="py-4 px-6 text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider w-1/3 bg-red-500/5">
                  Traditional Amazon Model
                </th>
                <th className="py-4 px-6 text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider w-1/3 bg-emerald-500/10">
                  FlexSell Wholesale Model
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {data?.rows?.map((row, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-4 px-6 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {row.feature}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-300 bg-red-500/5">
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{row.traditional}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-emerald-200 bg-emerald-500/10">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                      <span>{row.flexsell}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
