"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, Truck, BadgePercent, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { TrustBar } from "@/components/storefront/TrustBar";

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-12 pb-16 text-foreground">
      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-primary/10 via-background to-background py-16 text-center space-y-4 border-b">
        <div className="container mx-auto px-4 max-w-3xl">
          <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Our Mission & Vision
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2">
            Connecting Global Manufacturers Directly to Retailers
          </h1>
          <p className="text-muted-foreground text-base md:text-lg mt-3 leading-relaxed">
            Eliminating multi-tier traditional distribution markups to empower Indian shop owners, e-commerce sellers, and dropshippers with direct factory pricing.
          </p>
        </div>
      </section>

      {/* Trust Stats Bar */}
      <TrustBar />

      {/* Main Content */}
      <div className="container mx-auto px-4 max-w-5xl space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="aspect-video w-full bg-secondary rounded-2xl overflow-hidden relative shadow-lg border"
        >
          <Image
            src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=80"
            alt="FlexSell Wholesale B2B Sourcing Warehouse"
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Our B2B Sourcing Mission</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We cut down traditional multi-layer distributor margins in India. By establishing direct logistics with global manufacturers, we supply high-utility, trending items straight to small shop owners, e-commerce stores, and resellers, improving retail profit margins by up to 40%.
            </p>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">The Surat Logistics Hub</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Founded at the heart of Surat's transport corridor, FlexSell handles over 5,000 orders daily. Our 40,000 sq ft centralized warehouse is fully stocked with ready-to-dispatch consumer goods, kitchen gadgets, and utility items.
            </p>
          </div>
        </div>

        {/* Why Choose Us Cards */}
        <div className="space-y-6 pt-4 border-t">
          <h2 className="text-2xl font-extrabold text-center">Why B2B Buyers Trust FlexSell</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <BadgePercent className="h-7 w-7 text-primary" />, title: "Direct Factory Pricing", desc: "No middle-man wholesalers. Container-load imports distributed directly." },
              { icon: <ShieldCheck className="h-7 w-7 text-primary" />, title: "Rigorous Quality Screening", desc: "Dedicated sorting lines check electricals, plastic grades, and silicon seals." },
              { icon: <Truck className="h-7 w-7 text-primary" />, title: "Express Cargo Shipping", desc: "Partnership with Delhivery, Gati, and V-Trans for heavy freight." }
            ].map((item, idx) => (
              <div key={idx} className="p-6 bg-card border rounded-2xl space-y-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="p-3 bg-primary/10 rounded-xl w-max">{item.icon}</div>
                <h3 className="font-bold text-lg">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="rounded-2xl bg-gradient-to-r from-primary to-emerald-600 text-primary-foreground p-8 text-center space-y-4 shadow-lg">
          <h2 className="text-2xl md:text-3xl font-extrabold">Ready to Boost Your Retail Margins?</h2>
          <p className="text-sm max-w-xl mx-auto opacity-90">Explore thousands of trending items or register as a wholesale buyer today.</p>
          <div className="pt-2 flex justify-center gap-4">
            <Link href="/products">
              <Button size="lg" variant="secondary" className="font-bold cursor-pointer">
                Explore Catalog &rarr;
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" className="font-bold bg-background text-foreground hover:bg-background/90 cursor-pointer">
                Create B2B Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
