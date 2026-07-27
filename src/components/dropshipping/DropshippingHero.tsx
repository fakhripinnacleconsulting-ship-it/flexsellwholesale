"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Sparkles, ArrowRight, Download, ShieldCheck, CheckCircle, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { DropshippingCMSData } from "@/lib/seedDropshippingCMS";

interface DropshippingHeroProps {
  data: DropshippingCMSData["hero"];
  onRegisterClick?: () => void;
}

export function DropshippingHero({ data, onRegisterClick }: DropshippingHeroProps) {
  const heroImage = data?.heroImage || "/images/dropshipping/image1.png";

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white py-16 lg:py-24 border-b border-emerald-900/40">
      {/* Background Image Watermark Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none mix-blend-overlay">
        <img src={heroImage} alt="Background Watermark" className="w-full h-full object-cover filter blur-xs" />
      </div>

      {/* Decorative Glow Blobs with Continuous Floating Animation */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"
      />

      <div className="mx-auto max-w-7xl px-4 md:px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold uppercase tracking-wider backdrop-blur-md shadow-md"
            >
              <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span>{data?.badge || "FLEXSELL DROPSHIPPING 2026"}</span>
            </motion.div>

            {/* Main Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]"
            >
              Start your Amazon business with{" "}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-purple-400 bg-clip-text text-transparent">
                Zero Inventory Risk
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl"
            >
              {data?.subtitle ||
                "More Sales. Less Risk. Zero Inventory Investment. We handle product sourcing, quality control, storage, and order dispatch directly to your Amazon customers from our Surat hub."}
            </motion.p>

            {/* Highlight Banner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="inline-flex items-center gap-2 bg-emerald-950/70 border border-emerald-600/40 px-4 py-2 rounded-xl text-emerald-200 text-xs sm:text-sm backdrop-blur-md shadow-md"
            >
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Pay only when you receive an order. 100% automated fulfillment.</span>
            </motion.div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="pt-3 flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              {onRegisterClick ? (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={onRegisterClick}
                    size="lg"
                    className="font-extrabold text-sm sm:text-base px-8 py-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-900/40 transition-all duration-300 gap-2.5 cursor-pointer border-none"
                  >
                    <span>{data?.ctaText || "Apply as Dropshipper Partner"}</span>
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Link href={data?.ctaLink || "#register-form"}>
                    <Button
                      size="lg"
                      className="font-extrabold text-sm sm:text-base px-8 py-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-900/40 transition-all duration-300 gap-2.5 cursor-pointer border-none"
                    >
                      <span>{data?.ctaText || "Apply as Dropshipper Partner"}</span>
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </motion.div>
              )}

              <motion.a
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                href={data?.brochureUrl || "/docs/FLEXSELL_DROPSHIPPING_2026.pdf"}
                download="FLEXSELL_DROPSHIPPING_2026.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 font-bold text-sm sm:text-base px-7 py-3.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700/90 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 backdrop-blur-md shadow-md transition-all cursor-pointer"
              >
                <Download className="h-5 w-5 text-emerald-400" />
                <span>Download Brochure (PDF)</span>
              </motion.a>
            </motion.div>

            {/* Key Stat Cards */}
            {data?.stats && data.stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6"
              >
                {data.stats.map((stat, idx) => (
                  <motion.div
                    key={idx}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="p-3.5 rounded-2xl border border-emerald-900/50 bg-slate-900/80 backdrop-blur-md text-center flex flex-col items-center justify-center space-y-0.5 hover:border-emerald-500/50 transition-all shadow-md"
                  >
                    <span className="text-xl sm:text-2xl font-extrabold text-emerald-400">{stat.value}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{stat.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Right Image Showcase Card with Floating Animation */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="lg:col-span-5 flex justify-center"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="relative rounded-3xl overflow-hidden border-2 border-purple-500/40 shadow-2xl bg-slate-900 max-w-md w-full group"
            >
              <img
                src={heroImage}
                alt={data?.title || "FlexSell Dropshipping 2026 Program"}
                className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />

              {/* Overlay Floating Badges */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-4 right-4 bg-emerald-500/90 text-white font-extrabold text-[10px] uppercase px-3 py-1 rounded-full shadow-lg backdrop-blur-md tracking-wider flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                <span>24h Dispatch</span>
              </motion.div>

              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-4 rounded-2xl flex items-center gap-3.5 shadow-xl">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 font-bold shadow-md">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-white">Surat 40,000 Sq Ft Hub</h4>
                  <p className="text-[11px] text-slate-300">100% Quality Checked & White-labeled Packaging</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
