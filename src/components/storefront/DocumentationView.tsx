"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  Cpu,
  Layers,
  Database,
  ShieldCheck,
  Package,
  ShoppingCart,
  Receipt,
  CreditCard,
  Truck,
  Settings,
  Lock,
  Search,
  CheckCircle2,
  ArrowRight,
  Workflow,
  Sparkles,
  Server,
  Globe,
  ExternalLink,
  Copy,
  Check,
  Tag,
  Boxes,
  FileCheck,
  Activity,
  BadgePercent,
  Download,
  Printer,
  Menu,
  X,
  Code2,
  Key,
  Sliders,
  Terminal,
  AlertTriangle,
  HelpCircle,
  FileText
} from "lucide-react";
import { useToastStore } from "@/stores/toastStore";

const SECTIONS = [
  { id: "overview", label: "01. Product Overview & Personas", icon: BookOpen },
  { id: "architecture", label: "02. Layered Architecture", icon: Cpu },
  { id: "tech-stack", label: "03. Technology Stack Inventory", icon: Layers },
  { id: "routing", label: "04. App Routing Specification", icon: Globe },
  { id: "database", label: "05. Database Schema (17 Models)", icon: Database },
  { id: "auth", label: "06. Auth, Lockout & CSRF Security", icon: Lock },
  { id: "catalog", label: "07. Product Catalog & Price Tiers", icon: Package },
  { id: "inventory", label: "08. Atomic Inventory & Ledger", icon: Server },
  { id: "tax-engine", label: "09. Cart & GST Tax Engine", icon: ShoppingCart },
  { id: "order-lifecycle", label: "10. Order State Machine", icon: Workflow },
  { id: "documents", label: "11. Quote ➔ Receipt ➔ Invoice", icon: Receipt },
  { id: "payments", label: "12. Razorpay HMAC Verification", icon: CreditCard },
  { id: "shipping", label: "13. Shiprocket Logistics API", icon: Truck },
  { id: "admin-api", label: "14. Admin Modules & REST APIs", icon: Settings },
  { id: "security", label: "15. Security Control Matrix", icon: ShieldCheck }
];

export function DocumentationView() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [copiedSnippet, setCopiedSnippet] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);
  const { addToast } = useToastStore();

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const copySectionLink = (id: string) => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/documentation#${id}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      addToast("Direct section link copied to clipboard!", "success");
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const copyCodeSnippet = (snippet: string, label: string) => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(label);
    addToast(`${label} snippet copied to clipboard!`, "success");
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const triggerPdfPrint = () => {
    if (typeof window !== "undefined") {
      window.print();
      addToast("Opened browser print / Save as PDF dialog", "info");
    }
  };

  const downloadMarkdownDocumentation = () => {
    const content = `# FlexSell Wholesale — Master Technical Documentation Suite

> Application Version: 0.1.0  
> Framework: Next.js 16.2.10 (App Router) | React 19.2.4 | TypeScript 5.0  
> Database: MongoDB Atlas (Mongoose 9.7.4)  
> Architecture: Decoupled Unified Service Layer with Offline Sandbox & Live REST APIs  

---

# 1. PRODUCT OVERVIEW & PERSONA SEGMENTS
FlexSell Wholesale is an all-in-one B2B, B2C, and Dropshipping e-commerce platform engineered specifically for Indian manufacturers, importers, wholesale distributors, and resellers.

## Target Personas
1. B2B Wholesale Merchants: Tiered bulk prices, per-variant MOQs, formal quote requests, GST tax invoices.
2. B2C Retail Customers: Single-unit retail shopping, instant Razorpay/UPI payments, automated shipping tracking.
3. Dropshippers (Resellers): Direct-to-customer orders with packing slips omitting wholesale costs.
4. Platform Administrators: Camera barcode scanning, Shiprocket automated dispatch, CMS controls.

---

# 2. SYSTEM ARCHITECTURE
Four distinct architectural layers:
1. Presentation Layer: Storefront UI (React 19), Admin Dashboard, Client Portal.
2. State & Unified Services Layer: 14 Zustand Stores, 13 Services with mock mode fallback.
3. Server Controllers & API: Next.js API (/api/*) with Auth Guards and CSRF middleware.
4. Database & External APIs: MongoDB Atlas, Razorpay, Shiprocket, Vercel Blob.

---

# 3. TECHNOLOGY STACK INVENTORY
- Framework: Next.js 16.2.10 (App Router)
- UI Library: React / React DOM 19.2.4
- Language: TypeScript 5.0+
- Database: MongoDB / Mongoose 9.7.4
- State Management: Zustand 5.0.14
- Payments: Razorpay SDK 2.9.8 (HMAC-SHA256)
- Logistics: Shiprocket REST Integration
- Testing: Vitest 4.1.10

---

# 4. APPLICATION ROUTES SPECIFICATION
- / — Storefront homepage
- /products — Catalog listing with category filters & price sorting
- /products/[slug] — Product detail page with variant selector & B2B price tiers
- /quote — B2B quotation request form
- /checkout — Multi-step checkout with GST tax engine & Razorpay
- /client?view=orders — Customer order tracking, invoices & receipts
- /admin — 18-module administrative management console
- /api/health — MongoDB connection health check

---

# 5. DATABASE SCHEMA & MONGOOSE MODELS (17 MODELS)
1. Customer: B2C/B2B/Dropshipper accounts, bcrypt passwords, addresses, GSTINs, failedLoginAttempts lockout.
2. Product: Catalog items, color variants, subvariant matrix (Size x Weight x Price Tiers), HSN codes, barcodes.
3. Order: Purchase orders, items, shipping address, payment status (Pending, Paid), status transitions.
4. Invoice: B2B documents: Quotes (QUO-xxxx), Receipts (RCP-xxxx), Tax Invoices (INV-xxxx).
5. Category: Hierarchical taxonomy categories.
6. Collection: Manual or smart product groupings.
7. Coupon: Discount vouchers (flat/percentage, expiry, minOrderValue).
8. HsnRecord: HSN codes and GST rates.
9. StockLog: Inventory audit ledger.

---

# 6. AUTHENTICATION & SECURITY
- Session: Signed JWT tokens in httpOnly cookies (1-day expiry).
- CSRF Protection: Double-submit csrf_token cookie validated against X-CSRF-Token header.
- Account Lockout: Locked for 15 minutes after 10 consecutive failed password attempts.

---

# 7. PRODUCT CATALOG & MULTI-TIER PRICING
- Variant Matrix: Color x Size x Weight.
- Price Tiers: B2C Price, B2B Price (with MOQs), Dropshipping Price.

---

# 8. ATOMIC INVENTORY & AUDIT LEDGER
- Subvariant stock is atomically decremented during checkout via MongoDB $inc: -quantity queries.
- Order cancellations trigger matching $inc: +quantity restocking updates.

---

# 9. INDIAN GST TAX ENGINE SPECIFICATIONS
- Intrastate (Buyer State == Seller State): CGST = Total GST / 2, SGST = Total GST / 2.
- Interstate (Buyer State != Seller State): IGST = Total GST, CGST = 0, SGST = 0.

---

# 10. ORDER FULFILLMENT STATE MACHINE
Transitions: Placed ➔ Pending ➔ Confirmed ➔ Processing ➔ Awaiting Shipment ➔ Shipped ➔ In Transit ➔ Delivered.

---

# 11. B2B DOCUMENT LIFECYCLE (QUOTE ➔ RECEIPT ➔ INVOICE)
- Quote (QUO-xxxx): Negotiable draft quotation.
- Receipt (RCP-xxxx): Payment pending receipt voucher.
- Tax Invoice (INV-xxxx): Immutable legal tax invoice generated once payment succeeds.

---

# 12. RAZORPAY PAYMENT INTEGRATION
HMAC-SHA256 Verification in /api/razorpay/verify:
expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update("order_id|payment_id").digest("hex")

---

# 13. SHIPROCKET LOGISTICS
Communicates with Shiprocket REST APIs for courier serviceability, order creation, AWB labels, and tracking webhooks.

---

# 14. REST API DIRECTORY
Endpoints include /api/auth/*, /api/products/*, /api/orders/*, /api/razorpay/*, /api/shiprocket/*, /api/invoices/*, /api/health.

---

# 15. SECURITY CONTROL MATRIX
Content Security Policy (CSP), CSRF protection, Upstash Redis sliding-window rate limiting, and AES-256-GCM credential encryption.
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "FlexSell_Wholesale_Complete_Technical_Documentation.md");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Downloaded complete technical documentation (.md)", "success");
  };

  const filteredSections = SECTIONS.filter((sec) =>
    sec.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground py-6 px-4 md:px-6 select-none print:p-0 print:bg-white print:text-black">
      {/* Print CSS Rules */}
      <style jsx global>{`
        @media print {
          header, footer, nav, aside, .print-hide {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-doc-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-8xl space-y-6">
        {/* Top Header Banner with Action Buttons */}
        <div className="print-hide relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/95 via-primary to-primary/85 text-primary-foreground p-6 md:p-10 shadow-xl">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-black tracking-wider uppercase">
                <Sparkles className="h-3.5 w-3.5" />
                Industry Technical Guide & System Blueprint
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                FlexSell Wholesale Application Documentation
              </h1>
              <p className="text-xs md:text-sm text-primary-foreground/90 font-medium leading-relaxed">
                Complete technical documentation covering full-stack architecture, 17 Mongoose schemas, GST tax engine, Razorpay HMAC verification, and B2B document lifecycles.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                onClick={triggerPdfPrint}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black px-5 py-3 rounded-2xl shadow-xl transition-all text-xs cursor-pointer border border-emerald-400"
              >
                <Printer className="h-4 w-4" />
                <span>Save as PDF / Print</span>
              </button>

              <button
                onClick={downloadMarkdownDocumentation}
                className="flex items-center gap-2 bg-white text-primary font-black px-5 py-3 rounded-2xl shadow-xl hover:bg-white/90 transition-all text-xs cursor-pointer border border-white/40"
              >
                <Download className="h-4 w-4 text-primary" />
                <span>Download (.md)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Menu Bar (Visible on < lg screens) */}
        <div className="print-hide block lg:hidden sticky top-16 z-30 bg-card/95 backdrop-blur-xl border rounded-2xl p-3 shadow-md">
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              <span>{mobileMenuOpen ? "Close Menu" : "Documentation Menu"}</span>
            </button>

            <span className="text-xs font-bold text-muted-foreground truncate max-w-[180px]">
              {SECTIONS.find((s) => s.id === activeTab)?.label}
            </span>
          </div>

          {/* Mobile Drawer Dropdown */}
          {mobileMenuOpen && (
            <div className="mt-3 pt-3 border-t space-y-2 max-h-[60vh] overflow-y-auto">
              <div className="relative mb-2">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/60 border rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {filteredSections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeTab === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => scrollToSection(sec.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{sec.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Main Grid Layout: Desktop Sidebar + Single Page Document Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* DESKTOP SIDEBAR (Visible on lg+ screens) */}
          <aside className="print-hide hidden lg:block lg:col-span-3 space-y-4">
            <div className="sticky top-20 bg-card border rounded-2xl p-4 shadow-sm space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary/50 border rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-wider px-2 pt-1">
                Navigation Directory
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                {filteredSections.map((sec) => {
                  const Icon = sec.icon;
                  const isActive = activeTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-primary-foreground" : "text-primary"}`} />
                        <span className="truncate">{sec.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* DOCUMENT CONTENT PANE (Single Page Continuous Scroll) */}
          <main className="lg:col-span-9 bg-card border rounded-3xl p-6 md:p-10 shadow-sm space-y-16 print-doc-container">
            {/* SECTION 01: OVERVIEW */}
            <section id="overview" className="space-y-6 pt-2">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">System Blueprint</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    01. Product Overview & Persona Segments
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("overview")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                <strong>FlexSell Wholesale</strong> is an enterprise-grade B2B, B2C, and Dropshipping e-commerce platform engineered specifically for manufacturers, importers, wholesale distributors, and resellers. It features multi-tier pricing, GST tax compliance, automated Shiprocket dispatch, Razorpay payment verification, and B2B document generation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="bg-secondary/40 border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-primary">B2B Wholesale</span>
                    <Link href="/quote" className="print-hide text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                      Quote Page <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Bulk Sourcing & Quotes</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tiered bulk prices, per-variant MOQs, formal quotation conversion, and GST-compliant tax invoices containing business GSTINs.
                  </p>
                </div>
                <div className="bg-secondary/40 border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-emerald-600">B2C Commerce</span>
                    <Link href="/products" className="print-hide text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                      Catalog <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Direct Consumer Retail</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Single-unit retail purchases, instant UPI/Razorpay payments, automated shipping calculation, and live tracking.
                  </p>
                </div>
                <div className="bg-secondary/40 border rounded-xl p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-purple-600">Dropshipping</span>
                    <Link href="/dropshipping" className="print-hide text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                      Resellers <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Reseller Fulfillment</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Resellers place direct-to-customer orders with customized packing slips omitting wholesale cost information.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 02: ARCHITECTURE */}
            <section id="architecture" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Layered Design</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    02. Layered Application Architecture
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("architecture")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="bg-secondary/20 border rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-foreground">High-Level Flow Diagram</h3>
                <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono font-bold text-center">
                  <div className="bg-card border p-3 rounded-xl w-full">Storefront UI (React 19)</div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0 rotate-90 md:rotate-0" />
                  <div className="bg-card border p-3 rounded-xl w-full">Zustand Stores / Services</div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0 rotate-90 md:rotate-0" />
                  <div className="bg-card border p-3 rounded-xl w-full">Next.js API (/api/*)</div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0 rotate-90 md:rotate-0" />
                  <div className="bg-card border p-3 rounded-xl w-full">MongoDB Atlas</div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-bold text-sm text-foreground">Key Architecture Principles</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span><strong>Unified Client Services:</strong> All UI components invoke services in <code>src/services/</code> that support an offline <code>localStorage</code> sandbox when <code>isMockMode = true</code> and Next.js REST API routing when live.</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span><strong>Atomic Inventory Deductions:</strong> Product sub-variant stock is atomically decremented during order creation using MongoDB <code>$inc</code> and array filters.</span></li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" /> <span><strong>Stateless JWT & CSRF:</strong> Sessions are maintained via <code>httpOnly</code> cookies validated through <code>authGuard.ts</code> alongside double-submit CSRF token headers.</span></li>
                </ul>
              </div>
            </section>

            {/* SECTION 03: TECH STACK */}
            <section id="tech-stack" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Frameworks & Libraries</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    03. Technology Stack Inventory
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("tech-stack")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-secondary/60 text-foreground border-b font-bold uppercase text-[10px] tracking-wider">
                      <th className="p-3">Category</th>
                      <th className="p-3">Technology</th>
                      <th className="p-3">Version</th>
                      <th className="p-3">Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-muted-foreground">
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Framework</td>
                      <td className="p-3">Next.js (App Router)</td>
                      <td className="p-3 font-mono">16.2.10</td>
                      <td className="p-3">Full-stack React framework with server components & route handlers</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-foreground">UI Engine</td>
                      <td className="p-3">React / React DOM</td>
                      <td className="p-3 font-mono">19.2.4</td>
                      <td className="p-3">Component rendering & concurrent mode hooks</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Database</td>
                      <td className="p-3">MongoDB / Mongoose</td>
                      <td className="p-3 font-mono">9.7.4</td>
                      <td className="p-3">Document storage, schema validation & indexing</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-foreground">State Management</td>
                      <td className="p-3">Zustand</td>
                      <td className="p-3 font-mono">5.0.14</td>
                      <td className="p-3">Scoped client stores with localStorage persistence</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-foreground">Payments</td>
                      <td className="p-3">Razorpay SDK</td>
                      <td className="p-3 font-mono">2.9.8</td>
                      <td className="p-3">Online order creation & HMAC signature verification</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 04: ROUTING */}
            <section id="routing" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Route Directory</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    04. Application Routes Specification
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("routing")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <Link href="/" className="border rounded-xl p-4 bg-secondary/20 hover:border-primary transition-all group cursor-pointer block">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary group-hover:underline">/</span>
                    <ExternalLink className="print-hide h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-muted-foreground mt-1.5">Storefront homepage featuring CMS banners, categories, trending products & new arrivals.</p>
                </Link>
                <Link href="/products" className="border rounded-xl p-4 bg-secondary/20 hover:border-primary transition-all group cursor-pointer block">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary group-hover:underline">/products</span>
                    <ExternalLink className="print-hide h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-muted-foreground mt-1.5">Catalog listing with category filters, price sorting, tag search & pagination.</p>
                </Link>
                <Link href="/quote" className="border rounded-xl p-4 bg-secondary/20 hover:border-primary transition-all group cursor-pointer block">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary group-hover:underline">/quote</span>
                    <ExternalLink className="print-hide h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-muted-foreground mt-1.5">B2B bulk quotation request form for negotiated wholesale orders.</p>
                </Link>
                <Link href="/checkout" className="border rounded-xl p-4 bg-secondary/20 hover:border-primary transition-all group cursor-pointer block">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary group-hover:underline">/checkout</span>
                    <ExternalLink className="print-hide h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-muted-foreground mt-1.5">Multi-step checkout with coupon validation, GST calculation & Razorpay payment.</p>
                </Link>
              </div>
            </section>

            {/* SECTION 05: DATABASE */}
            <section id="database" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Data Models</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    05. Database Schema & Mongoose Models (17 Models)
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("database")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-xl p-4 space-y-2 bg-secondary/20">
                  <h3 className="font-bold text-foreground">Customer Model (<code>customers</code>)</h3>
                  <p className="text-muted-foreground">Stores B2C, B2B, and Dropshipping buyer accounts, bcrypt hashed passwords, address book, GSTINs, and <code>failedLoginAttempts</code> for account lockout.</p>
                </div>
                <div className="border rounded-xl p-4 space-y-2 bg-secondary/20">
                  <h3 className="font-bold text-foreground">Product Model (<code>products</code>)</h3>
                  <p className="text-muted-foreground">Maintains catalog products, color variants, subvariant matrices (Size × Weight × Price Tiers), HSN codes, and barcode scanner numbers.</p>
                </div>
                <div className="border rounded-xl p-4 space-y-2 bg-secondary/20">
                  <h3 className="font-bold text-foreground">Order Model (<code>orders</code>)</h3>
                  <p className="text-muted-foreground">Stores purchase orders, line item snapshots, shipping addresses, payment status (<code>Pending</code>, <code>Paid</code>), and order status transitions.</p>
                </div>
                <div className="border rounded-xl p-4 space-y-2 bg-secondary/20">
                  <h3 className="font-bold text-foreground">Invoice Model (<code>invoices</code>)</h3>
                  <p className="text-muted-foreground">Manages B2B documents: Quotes (<code>QUO-xxxx</code>), Receipts (<code>RCP-xxxx</code>), and Tax Invoices (<code>INV-xxxx</code>) with GST breakdowns.</p>
                </div>
              </div>
            </section>

            {/* SECTION 06: AUTH */}
            <section id="auth" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Security & Access</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    06. Authentication, Lockout & CSRF Rules
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("auth")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="bg-secondary/30 border rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-foreground">Account Lockout Protocol</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="bg-destructive/10 text-destructive border border-destructive/30 p-3 rounded-xl font-bold">10 Failed Password Attempts</div>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <div className="bg-card border p-3 rounded-xl font-bold">Account Locked for 15 Minutes</div>
                </div>
              </div>
            </section>

            {/* SECTION 07: CATALOG & PRICE TIERS */}
            <section id="catalog" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Catalog Engine</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    07. Product Catalog & Multi-Tier Pricing Architecture
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("catalog")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Supports multi-dimensional variant configurations (<strong>Color × Size × Weight</strong>) paired with a 3-tier price resolution matrix designed for Indian wholesale, retail, and dropshipping commerce.
              </p>

              <div className="bg-secondary/20 border rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" /> Variant Matrix Architecture
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="bg-card border p-4 rounded-xl space-y-1">
                    <span className="font-bold text-primary">Product (Root)</span>
                    <p className="text-muted-foreground text-[11px] font-sans">Title, slug, categoryId, hsnCode, gstRate, priceIncludesGst</p>
                  </div>
                  <div className="bg-card border p-4 rounded-xl space-y-1">
                    <span className="font-bold text-emerald-600">Color Variant</span>
                    <p className="text-muted-foreground text-[11px] font-sans">Color name, images array, subVariants list</p>
                  </div>
                  <div className="bg-card border p-4 rounded-xl space-y-1">
                    <span className="font-bold text-purple-600">SubVariant Matrix</span>
                    <p className="text-muted-foreground text-[11px] font-sans">Size, Weight, MRP, B2C Price, B2B Price, Dropship Price, Stock, SKU, Barcode</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="border rounded-xl p-4 bg-secondary/30 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-bold">
                    <BadgePercent className="h-4 w-4" />
                    <span>B2C Retail Price</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">Standard single-unit retail price applied to guest visitors and standard consumer accounts.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 font-bold">
                    <Tag className="h-4 w-4" />
                    <span>B2B Wholesale Price</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">Discounted bulk rate unlocked when minimum order quantity (MOQ) is met by B2B buyers.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/30 space-y-2">
                  <div className="flex items-center gap-2 text-purple-600 font-bold">
                    <Truck className="h-4 w-4" />
                    <span>Dropshipping Price</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">Wholesale reseller rate applied when dropshipping items directly to end customers.</p>
                </div>
              </div>
            </section>

            {/* SECTION 08: INVENTORY & LEDGER */}
            <section id="inventory" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Stock Control</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    08. Atomic Inventory Management & Audit Ledger
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("inventory")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="bg-secondary/20 border rounded-2xl p-6 space-y-3 font-mono text-xs">
                <h3 className="font-bold text-sm text-foreground font-sans">Atomic Stock Decrement Query</h3>
                <div className="bg-card border p-4 rounded-xl text-primary font-bold overflow-x-auto">
                  Product.updateOne(<br />
                  &nbsp;&nbsp;&#123; _id: productId, &quot;colorVariants.subVariants&quot;: &#123; $elemMatch: &#123; sku, stock: &#123; $gte: qty &#125; &#125; &#125; &#125;,<br />
                  &nbsp;&nbsp;&#123; $inc: &#123; &quot;colorVariants.$[cv].subVariants.$[sv].stock&quot;: -qty, totalStock: -qty &#125; &#125;,<br />
                  &nbsp;&nbsp;&#123; arrayFilters: [&#123; &quot;cv.color&quot;: color &#125;, &#123; &quot;sv.sku&quot;: sku &#125;] &#125;<br />
                  )
                </div>
              </div>
            </section>

            {/* SECTION 09: TAX ENGINE */}
            <section id="tax-engine" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Compliance Engine</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    09. Indian GST Tax Engine Specifications
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("tax-engine")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-xl p-4 bg-card space-y-2">
                  <span className="font-black text-primary uppercase">Intrastate (Same State)</span>
                  <p className="text-muted-foreground">Buyer State == Seller State (e.g. MP == MP)</p>
                  <div className="bg-secondary p-2.5 rounded-lg font-mono text-[11px] font-bold">
                    CGST = Total GST / 2<br />
                    SGST = Total GST / 2
                  </div>
                </div>
                <div className="border rounded-xl p-4 bg-card space-y-2">
                  <span className="font-black text-emerald-600 uppercase">Interstate (Different State)</span>
                  <p className="text-muted-foreground">Buyer State != Seller State (e.g. MH != MP)</p>
                  <div className="bg-secondary p-2.5 rounded-lg font-mono text-[11px] font-bold">
                    IGST = Total GST<br />
                    CGST = 0, SGST = 0
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 10: ORDER LIFECYCLE */}
            <section id="order-lifecycle" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">State Transitions</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    10. Order Fulfillment State Machine
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("order-lifecycle")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="bg-secondary/20 border rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold font-mono">
                  <span className="bg-card border px-3 py-1.5 rounded-lg">Placed</span>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <span className="bg-card border px-3 py-1.5 rounded-lg text-amber-600">Pending</span>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <span className="bg-card border px-3 py-1.5 rounded-lg text-blue-600">Confirmed</span>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <span className="bg-card border px-3 py-1.5 rounded-lg text-purple-600">Shipped</span>
                  <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  <span className="bg-card border px-3 py-1.5 rounded-lg text-emerald-600">Delivered</span>
                </div>
              </div>
            </section>

            {/* SECTION 11: DOCUMENTS */}
            <section id="documents" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">B2B Financial Workflow</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    11. Quote ➔ Receipt ➔ Invoice Lifecycle
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("documents")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-2">
                  <span className="font-bold text-amber-600 uppercase">1. Quote (QUO-xxxx)</span>
                  <p className="text-muted-foreground">Draft negotiable quotation for bulk wholesale orders. Fully editable before acceptance.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-2">
                  <span className="font-bold text-blue-600 uppercase">2. Receipt (RCP-xxxx)</span>
                  <p className="text-muted-foreground">Payment pending receipt voucher issued upon order submission before online payment verification.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-2">
                  <span className="font-bold text-emerald-600 uppercase">3. Invoice (INV-xxxx)</span>
                  <p className="text-muted-foreground">Immutable legal tax invoice generated automatically once payment verification succeeds.</p>
                </div>
              </div>
            </section>

            {/* SECTION 12: PAYMENTS */}
            <section id="payments" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Payment Security</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    12. Razorpay HMAC Signature Verification
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("payments")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="bg-secondary/20 border rounded-2xl p-6 space-y-3 font-mono text-xs">
                <p className="font-sans text-muted-foreground">
                  Online Razorpay payments must pass server-side HMAC-SHA256 signature verification in <code>/api/razorpay/verify</code> before an order status is set to <code>Paid</code>:
                </p>
                <div className="bg-card border p-4 rounded-xl text-primary font-bold overflow-x-auto">
                  expectedSignature = crypto.createHmac(&quot;sha256&quot;, RAZORPAY_KEY_SECRET)<br />
                  &nbsp;&nbsp;.update(&quot;order_id|payment_id&quot;)<br />
                  &nbsp;&nbsp;.digest(&quot;hex&quot;)
                </div>
              </div>
            </section>

            {/* SECTION 13: SHIPPING */}
            <section id="shipping" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Logistics Integration</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    13. Shiprocket Fulfillment & Webhooks
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("shipping")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
                Integrated directly with <strong>Shiprocket REST APIs</strong> for live courier serviceability, automated order fulfillment, shipping label generation, and real-time AWB tracking webhooks.
              </p>
            </section>

            {/* SECTION 14: ADMIN & API */}
            <section id="admin-api" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">API Directory</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    14. Admin Modules & REST API Directory
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("admin-api")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <Link href="/api/health" target="_blank" className="bg-secondary/40 border p-3 rounded-xl hover:border-primary transition-all flex justify-between items-center group cursor-pointer">
                  <span>/api/health (System Health Check)</span>
                  <ExternalLink className="print-hide h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                <div className="bg-secondary/40 border p-3 rounded-xl">/api/auth (Register, Login, Refresh)</div>
                <div className="bg-secondary/40 border p-3 rounded-xl">/api/products (Catalog & Import)</div>
                <div className="bg-secondary/40 border p-3 rounded-xl">/api/orders (Submission & Status)</div>
              </div>
            </section>

            {/* SECTION 15: SECURITY */}
            <section id="security" className="space-y-6 pt-4 border-t">
              <div className="border-b pb-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-primary">Defense in Depth</span>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-foreground mt-1">
                    15. Security Control Matrix & Cryptography
                  </h2>
                </div>
                <button
                  onClick={() => copySectionLink("security")}
                  className="print-hide flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors cursor-pointer bg-secondary px-3 py-1.5 rounded-lg border"
                >
                  {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Share</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-1">
                  <span className="font-bold text-foreground">Content Security Policy (CSP)</span>
                  <p className="text-muted-foreground">HTTP headers restricting script execution to self, Razorpay, and Google.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-1">
                  <span className="font-bold text-foreground">CSRF Protection</span>
                  <p className="text-muted-foreground">Double-submit cookie pattern with <code>X-CSRF-Token</code> validation.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-1">
                  <span className="font-bold text-foreground">Sliding Window Rate Limiting</span>
                  <p className="text-muted-foreground">Upstash Redis sliding window limiter preventing brute-force API attacks.</p>
                </div>
                <div className="border rounded-xl p-4 bg-secondary/20 space-y-1">
                  <span className="font-bold text-foreground">AES-256-GCM Encryption</span>
                  <p className="text-muted-foreground">Encrypted storage for sensitive API credentials in database settings.</p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
