"use client";

import React from "react";
import { Truck, Info } from "lucide-react";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";
import { formatPrice } from "@/lib/utils";

interface DropshippingShippingRatesProps {
  data: DropshippingCMSData["shippingRates"];
}

export function DropshippingShippingRates({ data }: DropshippingShippingRatesProps) {
  if (!data) return null;

  return (
    <section className="py-16 md:py-20 bg-white dark:bg-slate-950 px-4 sm:px-6 lg:px-8 border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-4xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5" />
            <span>Pan-India Logistics</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {data.heading || "PAN-INDIA SHIPPING CHARGES & WEIGHT SLABS"}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
            {data.subheading || "COMPETITIVE BULK LOGISTICS COURIER RATES"}
          </p>
        </div>

        {/* Shipping Slabs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.slabs?.map((slab, idx) => (
            <div
              key={idx}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center shadow-xs hover:border-emerald-500/50 transition-colors"
            >
              <div className="text-xs uppercase font-bold tracking-wider text-slate-500 mb-2">
                Weight Slab
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                {slab.weightSlab}
              </div>
              <div className="inline-block bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold px-3 py-1 rounded-lg text-sm">
                {formatPrice(slab.charge)} / order
              </div>
            </div>
          ))}
        </div>

        {/* Notes */}
        {data.pickPackNote && (
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex items-start gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <Info className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p>{data.pickPackNote}</p>
          </div>
        )}
      </div>
    </section>
  );
}
