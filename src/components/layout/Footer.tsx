"use client";

import * as React from "react";
import Link from "next/link";
import { Globe, Mail, MessageCircle, Phone, ArrowUp, Send, ShieldCheck, Truck, RefreshCw, MapPin, Clock, FileText, Lock, CreditCard, Banknote } from "lucide-react";
import Image from "next/image";
import { useCategoryStore } from "@/stores/categoryStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToastStore } from "@/stores/toastStore";


interface FooterProps {
  data?: {
    description?: string;
    officeAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
    timings?: string;
  };
}

export function Footer({ data }: FooterProps) {
  const { addToast } = useToastStore();
  const [newsletterEmail, setNewsletterEmail] = React.useState("");
  const [cmsInfo, setCmsInfo] = React.useState<any>(null);
  const [footerSettings, setFooterSettings] = React.useState<any>(null);

  const { categories, initializeCategories } = useCategoryStore();

  React.useEffect(() => {
    initializeCategories();
  }, [initializeCategories]);

  React.useEffect(() => {
    fetch("/api/cms")
      .then(res => res.json())
      .then(resData => {
        if (resData?.businessSettings) {
          setCmsInfo(resData.businessSettings);
        }
        if (resData?.footerSettings) {
          setFooterSettings(resData.footerSettings);
        }
      })
      .catch(err => console.error("Failed to load CMS footer settings:", err));
  }, []);

  const description = data?.description || cmsInfo?.description || "FlexSell is India's leading wholesale B2B distributor. Directly importing trending kitchen gadgets, household tools, utility items, and home appliances to provide low manufacturing prices.";

  const fullAddress = cmsInfo && cmsInfo.companyAddress
    ? `${cmsInfo.companyAddress}${cmsInfo.city ? `, ${cmsInfo.city}` : ""}${cmsInfo.state ? `, ${cmsInfo.state}` : ""}${cmsInfo.pinCode ? ` - ${cmsInfo.pinCode}` : ""}`
    : null;

  const officeAddress = data?.officeAddress || fullAddress || "Plot No. 12, GIDC Industrial Estate, Sachin, Bhopal, Madhya Pradesh - 394230";
  const contactEmail = data?.contactEmail || cmsInfo?.supportEmail || "support@flexsellwholesale.com";
  const contactPhone = data?.contactPhone || cmsInfo?.supportPhone || "+91 88877 66655";
  const timings = data?.timings || cmsInfo?.timings || "9:30 AM to 6:30 PM (Sunday Closed)";

  const [isSubscribing, setIsSubscribing] = React.useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim() || !newsletterEmail.includes("@")) {
      addToast("Please enter a valid email address.", "warning");
      return;
    }
    setIsSubscribing(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to subscribe");
      }
      addToast("Subscribed to FlexSell B2B Wholesale deal alerts!", "success");
      setNewsletterEmail("");
    } catch (err: unknown) {
      addToast((err as any).message || "Failed to subscribe. Please try again.", "error");
    } finally {
      setIsSubscribing(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-card border-t border-border pt-16 pb-8 text-foreground select-none relative overflow-hidden no-print print:hidden">
      <div className="mx-auto max-w-8xl px-4 md:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12 w-full">
        {/* Brand Column */}
        <div className="space-y-4 col-span-1 sm:col-span-2 lg:col-span-2">
          <Link href="/" className="inline-block">
            <Image src="/Flexsell%20Logo.png" alt="Flexsell Wholesale Logo" width={170} height={48} className="h-9 sm:h-11 w-auto object-contain" />
          </Link>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-md">
            {description}
          </p>

          {/* Key Value Proposition Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-secondary/30">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-[11px]">Factory Importer</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-secondary/30">
              <Truck className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-[11px]">Pan-India Logistics</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-secondary/30">
              <RefreshCw className="h-4 w-4 text-primary shrink-0" />
              <span className="font-semibold text-[11px]">Transit Protection</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <span className="text-xs text-muted-foreground font-semibold">Connect with us:</span>
            {Array.isArray(footerSettings?.socialLinks) && footerSettings.socialLinks.length > 0 ? (
              footerSettings.socialLinks.map((link: any) => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-2 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors" title={link.name}>
                  {link.iconUrl ? (
                    <img src={link.iconUrl} alt={link.name} className="h-4 w-4 object-contain" />
                  ) : (
                    <Globe className="h-4 w-4" />
                  )}
                </a>
              ))
            ) : (
              <>
                <Link href="https://flexsellwholesale.com" target="_blank" className="p-2 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  <Globe className="h-4 w-4" />
                </Link>
                <a href={`mailto:${contactEmail}`} className="p-2 rounded-full border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  <Mail className="h-4 w-4" />
                </a>
              </>
            )}
          </div>
        </div>

        {Array.isArray(footerSettings?.footerColumns) && footerSettings.footerColumns.length > 0 ? (
          footerSettings.footerColumns.map((col: any) => (
            <div key={col.id}>
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-4">{col.title}</h4>
              <ul className="space-y-2.5 text-xs text-muted-foreground font-medium">
                {col.links?.map((link: any, idx: number) => (
                  <li key={idx}><Link href={link.url} className="hover:text-foreground transition-colors">{link.label}</Link></li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-4">Business Hub</h4>
            <ul className="space-y-2.5 text-xs text-muted-foreground font-medium">
              <li><Link href="/products" className="hover:text-foreground transition-colors">All B2B Products</Link></li>
              <li><Link href="/products?sort=trending" className="hover:text-foreground transition-colors">Trending SKUs</Link></li>
              <li><Link href="/client/orders" className="hover:text-foreground transition-colors">Orders & Tracking</Link></li>
              <li><Link href="/dropshipping" className="hover:text-foreground transition-colors">Dropshipping Program</Link></li>
              <li><Link href="/faq" className="hover:text-foreground transition-colors">Help & FAQ</Link></li>
              <li><Link href="/blogs" className="hover:text-foreground transition-colors">Industry Blogs</Link></li>
            </ul>
          </div>
        )}

        {/* Top Collections (Dynamic) */}
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-4">Top Collections</h4>
          <ul className="space-y-2.5 text-xs text-muted-foreground font-medium">
            {(footerSettings?.showTopCategories !== false && categories.length > 0) ? (
              categories.slice(0, 4).map((cat) => (
                <li key={cat._id}><Link href={`/products?category=${cat.slug}`} className="hover:text-foreground transition-colors">{cat.name}</Link></li>
              ))
            ) : (
              <>
                <li><Link href="/products?category=kitchen" className="hover:text-foreground transition-colors">Kitchen Appliances</Link></li>
                <li><Link href="/products?category=home-tools" className="hover:text-foreground transition-colors">Home Utilities</Link></li>
                <li><Link href="/products?category=electronics" className="hover:text-foreground transition-colors">Electronics & Gadgets</Link></li>
              </>
            )}
            <li><Link href="/categories" className="text-primary font-bold hover:underline transition-colors mt-2 inline-block">View All Categories &rarr;</Link></li>
          </ul>
        </div>

        {/* Contact Info & Deal Alerts */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase tracking-wider text-primary">B2B Trade Support</h4>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p className="flex items-start gap-1.5 font-medium text-foreground">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{officeAddress}</span>
            </p>
            <p className="flex items-center gap-1.5 pt-1">
              <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{contactEmail}</span>
            </p>
            <p className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{contactPhone}</span>
            </p>
            <p className="flex items-center gap-1.5 text-primary font-semibold">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{timings}</span>
            </p>
          </div>

          <form onSubmit={handleSubscribe} className="space-y-2 pt-2 border-t border-border/50">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Get Weekly Deal Alerts</label>
            <div className="flex gap-1.5">
              <Input
                type="email"
                placeholder="Enter business email..."
                className="h-8.5 text-xs bg-background"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={isSubscribing} className="h-8.5 px-3 text-xs shrink-0 font-bold gap-1 cursor-pointer">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Corporate Policies & Legal Links Bar */}
      <div className="mx-auto max-w-8xl px-4 md:px-6 py-4 border-t border-border/60 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <Link href="/policies/privacy" className="hover:text-primary transition-colors flex items-center gap-1">
            <Lock className="h-3 w-3 text-primary" /> Privacy Policy
          </Link>
          <span className="text-border">•</span>
          <Link href="/policies/terms" className="hover:text-primary transition-colors flex items-center gap-1">
            <FileText className="h-3 w-3 text-primary" /> Terms of Service
          </Link>
          <span className="text-border">•</span>
          <Link href="/policies/shipping" className="hover:text-primary transition-colors flex items-center gap-1">
            <Truck className="h-3 w-3 text-primary" /> Shipping Policy
          </Link>
          <span className="text-border">•</span>
          <Link href="/policies/return" className="hover:text-primary transition-colors flex items-center gap-1">
            <RefreshCw className="h-3 w-3 text-primary" /> Return & Refund Policy
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider border border-primary/20">
            GST Invoice Compliant
          </span>
        </div>
      </div>

      {/* Bottom Copyright & Payment Badge Bar */}
      <div className="mx-auto max-w-8xl px-4 md:px-6 pt-6 border-t border-border/60 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground w-full">
        <p>&copy; {new Date().getFullYear()} FlexSell Wholesale B2B Portal. All rights reserved.</p>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 md:gap-4 flex-wrap text-[10px] font-bold uppercase tracking-wider">
            {Array.isArray(footerSettings?.paymentBadges) && footerSettings.paymentBadges.length > 0 ? (
              footerSettings.paymentBadges.map((badge: any) => (
                <span key={badge.id} className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-2.5 py-1.5 rounded border border-border shadow-sm">
                  {badge.iconUrl && <img src={badge.iconUrl} alt={badge.name} className="h-3.5 w-3.5 object-contain" />}
                  {badge.name}
                </span>
              ))
            ) : (
              <>
                <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-2.5 py-1.5 rounded border border-border shadow-sm">
                  <Phone className="h-3.5 w-3.5 text-blue-500" /> UPI / NetBanking
                </span>
                <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-2.5 py-1.5 rounded border border-border shadow-sm">
                  <Globe className="h-3.5 w-3.5 text-indigo-500" /> Razorpay
                </span>
                <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-2.5 py-1.5 rounded border border-border shadow-sm">
                  <CreditCard className="h-3.5 w-3.5 text-orange-500" /> Credit/Debit
                </span>
                <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-2.5 py-1.5 rounded border border-border shadow-sm">
                  <Banknote className="h-3.5 w-3.5 text-emerald-500" /> COD
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer bg-primary/10 px-3 py-1 rounded-full border border-primary/20 transition-all hover:bg-primary/20"
          >
            Top <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
