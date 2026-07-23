"use client";

import * as React from "react";
import Link from "next/link";
import { Globe, Mail, MessageCircle, Phone, ArrowUp, Send, ShieldCheck, Truck, RefreshCw } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";

interface FooterProps {
  data?: {
    description: string;
    officeAddress: string;
    contactEmail: string;
    contactPhone: string;
    timings: string;
  };
}

export function Footer({ data }: FooterProps) {
  const { addToast } = useToastStore();
  const [newsletterEmail, setNewsletterEmail] = React.useState("");

  const description = data?.description || "FlexSell is India's leading wholesale B2B distributor. Directly importing trending kitchen gadgets, household tools, utility items, and home appliances to provide you the lowest manufacturing prices.";
  const officeAddress = data?.officeAddress || "Block D-104, B2B Textile Market, Near Ring Road, Surat, Gujarat - 395002";
  const contactEmail = data?.contactEmail || "support@flexsellwholesale.in";
  const contactPhone = data?.contactPhone || "+91 88877 66655";
  const timings = data?.timings || "9:30 AM to 6:30 PM (Sunday Closed)";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    addToast("Subscribed to B2B Wholesale newsletter & deal alerts!", "success");
    setNewsletterEmail("");
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-card border-t pt-16 pb-8 text-foreground select-none">
      <div className="mx-auto max-w-8xl px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12 w-full">
        {/* Brand Column */}
        <div className="space-y-4 lg:col-span-2">
          <Link href="/" className="flex items-center">
            <Image src="/Flexsell%20Logo.png" alt="Flexsell Logo" width={160} height={44} className="h-10 md:h-12 w-auto object-contain" />
          </Link>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-sm">
            {description}
          </p>

          {/* Trust Highlights */}
          <div className="flex flex-col gap-2 pt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary shrink-0" /> Verified Factory Importer</span>
            <span className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4 text-primary shrink-0" /> Nationwide Cargo Freight Dispatch</span>
            <span className="flex items-center gap-2 font-medium"><RefreshCw className="h-4 w-4 text-primary shrink-0" /> Direct Transit Damage Replacement</span>
          </div>

          <div className="flex gap-4 pt-2">
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Globe className="h-5 w-5" /></Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><MessageCircle className="h-5 w-5" /></Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Mail className="h-5 w-5" /></Link>
            <Link href="#" className="text-muted-foreground hover:text-primary transition-colors"><Phone className="h-5 w-5" /></Link>
          </div>
        </div>

        {/* Wholesale B2B */}
        <div>
          <h4 className="font-bold text-sm mb-4 text-foreground uppercase tracking-wider">Wholesale Sourcing</h4>
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li><Link href="/products" className="hover:text-primary transition-colors">Wholesale Bulk Catalog</Link></li>
            <li><Link href="/categories" className="hover:text-primary transition-colors">Factory Direct Categories</Link></li>
            <li><Link href="/quote" className="hover:text-primary transition-colors">Get Bulk Sourcing Quote</Link></li>
            <li><Link href="/about" className="hover:text-primary transition-colors">About FlexSell B2B</Link></li>
            <li><Link href="/contact" className="hover:text-primary transition-colors">Warehouse Sourcing Contact</Link></li>
          </ul>
        </div>

        {/* Dropshipping Hub */}
        <div>
          <h4 className="font-bold text-sm mb-4 text-foreground uppercase tracking-wider">Dropshipping Hub</h4>
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li><Link href="/dropshipping" className="text-primary font-bold hover:underline transition-colors">Dropshipping Program</Link></li>
            <li><Link href="/dropshipping#register-form" className="hover:text-primary transition-colors">Apply as Partner</Link></li>
            <li><Link href="/register" className="hover:text-primary transition-colors">Create Dropshipper Account</Link></li>
            <li><Link href="/faq" className="hover:text-primary transition-colors">Dropshipping FAQ</Link></li>
            <li><Link href="/client/support" className="hover:text-primary transition-colors">Partner Help Desk</Link></li>
          </ul>
        </div>

        {/* Contact Info & Newsletter */}
        <div className="space-y-4">
          <h4 className="font-bold text-sm text-foreground uppercase tracking-wider">Contact & Newsletter</h4>
          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <li className="font-medium text-foreground">{officeAddress}</li>
            <li className="pt-1">Email: {contactEmail}</li>
            <li>Phone: {contactPhone}</li>
            <li className="text-primary font-semibold">Timing: {timings}</li>
          </ul>

          <form onSubmit={handleSubscribe} className="space-y-2 pt-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase">Get B2B Deals Newsletter</label>
            <div className="flex gap-1">
              <Input
                type="email"
                placeholder="Enter email..."
                className="h-8 text-xs"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0 cursor-pointer">
                <Send className="h-3 w-3" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Bottom Copyright & Back to Top Bar */}
      <div className="mx-auto max-w-8xl px-4 md:px-6 border-t pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground w-full">
        <p>&copy; {new Date().getFullYear()} FlexSell Wholesale B2B Market. All rights reserved.</p>
        
        <div className="flex items-center gap-6">
          <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
            <span className="bg-secondary px-2 py-0.5 rounded border">UPI</span>
            <span className="bg-secondary px-2 py-0.5 rounded border">Razorpay</span>
            <span className="bg-secondary px-2 py-0.5 rounded border">GST Invoice</span>
            <span className="bg-secondary px-2 py-0.5 rounded border">Cargo Transport</span>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            Top <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
