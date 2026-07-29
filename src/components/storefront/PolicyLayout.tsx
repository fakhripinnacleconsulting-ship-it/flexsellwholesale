import * as React from "react";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/sanitize";
import { ShieldCheck, FileText, Truck, RotateCcw, Printer, ArrowLeft } from "lucide-react";

export interface PolicySection {
  heading: string;
  text: string;
}

export interface PolicyLayoutProps {
  title: string;
  lastUpdated?: string;
  activeKey: "privacy" | "terms" | "shipping" | "return";
  content?: string;
  sections?: PolicySection[];
}

export function PolicyLayout({ title, lastUpdated, activeKey, content, sections = [] }: PolicyLayoutProps) {
  const navItems = [
    { key: "privacy", label: "Privacy Policy", icon: ShieldCheck, href: "/policies/privacy" },
    { key: "terms", label: "Terms of Service", icon: FileText, href: "/policies/terms" },
    { key: "shipping", label: "Shipping & Logistics", icon: Truck, href: "/policies/shipping" },
    { key: "return", label: "Returns & Refunds", icon: RotateCcw, href: "/policies/return" },
  ];

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl text-foreground">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-4 mb-8 print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Storefront
        </Link>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Printer className="h-3.5 w-3.5 text-primary" />
          <span>Press Ctrl+P to Print Policy</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left Navigation Sidebar */}
        <div className="md:col-span-3 space-y-2 print:hidden">
          <span className="text-[10px] font-extrabold uppercase text-muted-foreground tracking-wider block mb-2 px-2">
            Legal & Compliance
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Main Content Body */}
        <div className="md:col-span-9 space-y-6 bg-card border rounded-2xl p-6 md:p-10 shadow-sm print:p-0 print:border-none print:shadow-none">
          <div className="border-b pb-4">
            <span className="text-xs font-extrabold uppercase text-primary tracking-wider border px-2.5 py-1 rounded-full bg-primary/10">
              Legal Disclosure
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-3 text-foreground">
              {title}
            </h1>
            <p className="text-muted-foreground text-xs font-semibold mt-1">
              Last updated: {lastUpdated || "July 2026"}
            </p>
          </div>

          {content ? (
            <div
              className="prose prose-slate dark:prose-invert max-w-none text-foreground leading-relaxed text-sm md:text-base space-y-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          ) : (
            <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
              {sections.map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <h2 className="text-lg font-bold mt-6 text-foreground">{section.heading}</h2>
                  <p className="text-muted-foreground leading-relaxed text-sm md:text-base">{section.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
