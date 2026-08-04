# FlexSell Wholesale — Features & Services Catalogue

**Platform:** Enterprise B2B Wholesale, Retail (B2C) & Dropshipping E-Commerce Suite
**Prepared for:** Client Handover / Commercial Presentation
**Document Version:** 1.0

---

## 1. Executive Summary

FlexSell Wholesale is a single, unified commerce platform that runs **three business models simultaneously** — Wholesale (B2B), Retail (B2C), and Dropshipping — from one product catalogue, one inventory pool, and one admin control panel.

The platform covers the complete commercial cycle: customer onboarding and KYC verification → catalogue browsing and quotation → order placement and online payment → GST-compliant tax invoicing → courier dispatch and live tracking → post-sale support and reviews.

### Platform at a Glance

| Metric | Delivered |
| :--- | :--- |
| Business Models Supported | 3 (B2B / B2C / Dropshipping) |
| User Portals | 4 (Storefront, Customer, Manager, Admin) |
| Application Screens | 90+ |
| REST API Endpoints | 73 |
| Database Collections | 19 |
| Business Service Modules | 14 |
| Manager Permission Controls | 24 granular permissions across 8 modules |
| Automated Email Templates | 30 |
| Third-Party Integrations | 6 (Razorpay, Shiprocket, Google, SMTP, Vercel Blob, Sentry) |

---

## 2. Core Business Capabilities

### 2.1 Three-in-One Commerce Model

A single deployment serves three distinct customer segments, each with its own pricing, workflow and document trail:

| Segment | Pricing Tier | Key Behaviour |
| :--- | :--- | :--- |
| **B2C (Retail)** | Retail price | Direct checkout, standard shipping, retail invoice |
| **B2B (Wholesale)** | Wholesale price + MOQ | Bulk matrix ordering, quotation workflow, GST invoice, fixed freight |
| **Dropshipping** | Dropship price | Reseller pricing, drop-address shipping, dedicated onboarding page |

A single customer account can hold **multiple segments at once** (e.g. both B2C and B2B) — the system automatically resolves the correct price tier at every stage.

### 2.2 Multi-Tier Pricing Engine

- Four price points stored per SKU: **MRP, B2C Price, B2B Price, Dropshipping Price**
- **Minimum Order Quantity (MOQ)** enforcement per SKU for wholesale buyers
- Per-SKU and per-product **discount** control
- **Packaging charges** configurable as per-unit or per-order, at product, colour-variant or SKU level
- **Global Highlight Price** tool — bulk price campaigns across the catalogue
- Automatic tier resolution based on the logged-in customer's verified segment

### 2.3 Customer Upgrade & KYC Verification

- Retail customers can apply to upgrade to **B2B** or **Dropshipping** status
- Document upload workflow: **GST Certificate, PAN Card, Aadhaar Card, Cancelled Cheque, Passport Photo, Signature**
- Admin review queue with **Approve / Reject + rejection reason**
- Status tracking (`none → pending → approved / rejected`) visible to the customer
- Wholesale prices are unlocked **only after verification** — protecting your trade pricing

---

## 3. Product Catalogue Management

### 3.1 Advanced Product & Variant Structure

- **Two-level variant matrix:** Colour Variant → Sub-Variant (Size × Weight)
- Every sub-variant carries its own **SKU, barcode, stock, four prices, MOQ, discount and packaging charge**
- Per-colour **image galleries** (images and video URLs supported)
- Physical attributes per variant: **weight in grams, dimensions (L × B × H in cm)** — used for automatic freight calculation
- **A+ Content Builder** — rich product storytelling blocks (text, image, image+text, feature lists), Amazon-style
- **Field Visibility Controls** — show/hide description, sizes, weights, dimensions or images per product
- Rich-text description editor (Quill) with sanitised HTML output

### 3.2 Categories & Collections

- **Hierarchical categories** with parent-child nesting, images, slugs and custom sort order
- **Manual Collections** — hand-picked product lists
- **Smart Collections** — auto-populating rule engine (match ALL / ANY on tag, category, price, title, stock, vendor with 6 operators)
- Featured collections with banner images for homepage merchandising
- Per-collection SEO fields

### 3.3 Bulk Catalogue Operations

- **Excel/CSV Import** of products and variants with a pre-import validation panel
- **Excel Export** of the full catalogue
- **Bulk Operations Modal** — mass price updates, status toggles and field edits
- **Printable B2B Catalogue** — generates a variant-level, image-rich wholesale rate list for sharing with buyers
- **Barcode Sheet Download** — print-ready barcode labels for warehouse stock

---

## 4. Inventory & Warehouse Operations

- **Real-time stock tracking** at SKU level with automatic total-stock rollup
- **Camera Barcode Scanner** — scan physical barcodes via mobile or desktop camera to adjust stock instantly
- **USB Barcode Scanner support** — hardware scanner listener for warehouse terminals
- Automatic barcode generation per SKU (auto / manual / image-upload modes)
- **Warehouse Audit Ledger** — every stock movement permanently logged with SKU, product, variant, change quantity, previous stock, new stock and timestamp
- Movement types tracked: **Scan Adjustment, CSV Bulk Import, Order Deduction, Manual Adjustment**
- **Atomic stock deduction** on order placement — prevents overselling under concurrent orders
- **Low-stock alerts** surfaced on the analytics dashboard

---

## 5. Sales, Orders & Fulfilment

### 5.1 Order Lifecycle

Nine-stage order state machine with a full audit history:

`Placed → Pending → Confirmed → Processing → Awaiting Shipment → In Transit → Shipped → Delivered` (with `Cancelled` at any permitted stage)

- Every status change is timestamped and recorded with a description in the order history
- Orders segmented by **type** (B2B / B2C / Dropshipping) and **origin** (website vs. self-created by staff)
- **Admin-created orders** — staff can raise orders on behalf of customers, including conversion directly from an accepted quotation
- **Customer-initiated cancellation** permitted on early-stage orders
- **Automated housekeeping:** abandoned-order reaping and pending-order cancellation jobs

### 5.2 Quote → Receipt → Invoice Lifecycle (B2B)

A complete commercial document chain with independent numbering series:

| Document | Prefix | Status Workflow |
| :--- | :--- | :--- |
| **Quotation** | `QUO-` | draft → finalized → sent → accepted / rejected / expired → converted |
| **Payment Receipt** | `RCP-` | pending → paid / failed / cancelled / refunded |
| **Tax Invoice** | `INV-` | paid / void / archived |

- Customer-facing **"Request a Quote"** flow directly from the cart
- Quote acceptance/rejection notifications to sales team
- One-click conversion of an accepted quote into a confirmed order
- **Configurable ID formats** — prefix, padding and numbering series editable from Settings
- Print/PDF-ready branded documents with company logo, digital signature and bank details
- Document archiving and dedicated Invoices / Quotes / Receipts ledgers

### 5.3 Indian GST Taxation Engine

- **Automatic intrastate vs. interstate detection** based on seller state and buyer's shipping state
- **CGST + SGST split** for intrastate; **IGST** for interstate transactions
- **HSN-wise tax slab breakdown** on every invoice (HSN code, GST rate, taxable base, tax split)
- **HSN Master Manager** — maintain HSN codes with their GST rates and apply to products
- Support for **GST-inclusive and GST-exclusive** pricing modes per product
- **GSTIN capture** for both seller and buyer, printed on tax invoices
- Server-side order total re-computation with tolerance validation — protects against tampered client-side totals

---

## 6. Payments

- **Razorpay integration** — Cards, UPI, Net Banking and Wallets
- **Server-side HMAC-SHA256 signature verification** on every payment
- Razorpay order IDs are minted server-side from the order's own amount, so a signature captured from a cheaper order cannot settle a larger one — **payment-tampering protected**
- **Razorpay webhook** listener for asynchronous payment confirmations
- Additional payment modes supported: **Bank Transfer, UPI, Cash on Delivery**
- Payment status tracking (`Pending / Paid / Failed`) with transaction ID storage
- COD and online payments individually toggleable from Admin Settings
- Bank wire instructions printed on quotations and invoices

---

## 7. Shipping & Logistics

### 7.1 Shiprocket Integration (Full Lifecycle)

- **Pin-code serviceability check** with live courier options
- **Order push and AWB generation** to Shiprocket
- **Shipping label download** (print-ready)
- **Live shipment tracking** with courier name, AWB, ETD and tracking URL
- **Shipment cancellation**
- **Webhook receiver** for automatic status sync from courier to order timeline
- Pickup address, channel ID and credentials configurable from Admin

### 7.2 Freight Calculation

- **Weight-slab based shipping rates** (from-gram / to-gram / amount) — fully configurable
- **Volumetric weight calculation** from product dimensions; higher of actual vs. volumetric is charged
- **Fixed freight override** for B2B and Dropshipping orders
- Manual / self-shipping and third-party courier options with manual tracking entry
- Branded **Shipping Label document** generator for self-dispatch

---

## 8. Storefront & Customer Experience

### 8.1 Shopping Experience

- Responsive homepage with **hero carousel, trust bar, featured collections, trending products, new arrivals, testimonials and brand partners** — all CMS-controlled
- **Mega menu** navigation with category imagery
- Product listing with faceted filters — **category, price range, stock availability, discount**
- **Bulk Variant Matrix** on product pages — wholesale buyers enter quantities for multiple SKUs (all colour/size/weight combinations) in a single grid and add them to cart in one action
- **Recently Viewed** products tracking
- Related and suggested product carousels
- **Wishlist** (persisted to the customer account)
- Cart with live tier pricing, coupon application and tax preview
- Multi-step checkout: shipping address → coupon → payment
- Order confirmation page with full summary
- **Dark / Light theme** toggle across the entire application

### 8.2 Intelligent Search

- **Weighted relevance-scoring engine** (Product ID → SKU/Barcode → Title → Category → HSN → Tags → SEO keywords → Description)
- **Exact SKU and barcode lookup** — warehouse-grade precision for B2B buyers
- **Typo tolerance** — Levenshtein distance matching plus a curated typo-alias dictionary
- **Live autocomplete suggestions** including SKU suggestions and matching categories
- Search facets with category counts and dynamic price bounds
- Multiple sort modes

### 8.3 Customer Account Portal

- Dashboard with order summary
- **Order history and order detail** with live shipment tracking
- **Address book** with multiple saved addresses, GSTIN per address and default selection
- **Profile management** and password change
- **My Coupons** — personalised coupon wallet
- **Wishlist** management
- **My Reviews**
- **Notifications centre** with per-category preferences
- **Support / Inquiry** submission
- **Account upgrade** application with document upload

---

## 9. Marketing, Content & SEO

### 9.1 Content Management System (No-Code)

Fully self-manageable website content across six CMS modules:

| Module | Editable Content |
| :--- | :--- |
| **Home Page CMS** | Hero banners, trust statistics, wholesale & dropshipping sections, testimonials (3 audience types), brand partners, section visibility, homepage SEO |
| **Dropshipping Page** | Hero, how-it-works, pricing plans, comparison table, shipping rates, bank & GST details, terms accordion |
| **Blogs & Articles** | Full blog publishing with rich-text editor and SEO fields |
| **FAQs Manager** | Question/answer sets rendered on the storefront |
| **Policies Manager** | Privacy, Return, Shipping and Terms pages |
| **Footer Settings** | Footer columns, links and contact details |

Plus **Announcement Bar** and **Banner** managers, and dynamic **custom pages** (`/pages/[slug]`).

### 9.2 Coupons & Promotions

- **Percentage or flat** discount types
- Minimum order value and maximum discount cap
- Expiry date control
- **Personalised coupons** targeted at specific customers
- **Global usage limit** and **per-customer usage limit**
- Usage tracking (used count and used-by list)
- Server-side coupon validation at checkout
- **"Coupon Live" email campaign** — notify customers when a coupon activates

### 9.3 SEO & Analytics

- **Dynamic metadata** generation for every page, editable via CMS
- **JSON-LD structured data:** Organization, WebSite, LocalBusiness, Product, Breadcrumb, FAQ, BlogArticle, Collection, Category schemas
- **Auto-generated sitemap.xml and robots.txt**
- **SEO Keyword Engine** — programmatic keyword combination generator across brand, service, category, intent, location and question patterns
- Open Graph and canonical URL handling
- **Google Tag Manager integration** with full e-commerce event tracking: view_item, add_to_cart, remove_from_cart, begin_checkout, purchase, search, login, sign_up
- **Vercel Analytics** integration

### 9.4 Reviews & Social Proof

- Star ratings and written reviews on products
- **Admin moderation queue** — approve/reject before publication
- Automatic rating average and review count rollup on products
- Customer notified on review submission and moderation outcome

### 9.5 Lead Capture

- **Newsletter subscription** capture
- **Five inquiry channels:** Wholesale, Dropshipping, Support, Franchise, General
- Inquiry workflow with status (`new → in progress → resolved → closed`), internal admin notes, and expected-order-volume/product-interest capture
- Auto-acknowledgement to the customer plus alert to the admin team
- **Reply-to-inquiry** email dispatch from the admin panel
- Dedicated **Dropshipping landing page** with pricing plans, comparison table and registration form

---

## 10. Administration & Team Management

### 10.1 Admin Control Centre (25 Modules)

Overview dashboard, Analytics, Products, Categories, Collections, Orders, Order Detail, Customers, Customer Detail, Managers, Invoices, Coupons, HSN Master, Shipping, Reviews, Inquiries, Upgrade Requests, CMS, Blogs, Banners, Announcements, Pages, Settings, Inventory, Bulk Operations.

### 10.2 Business Analytics Dashboard

- **Revenue trend** area chart
- **Order status breakdown** bar chart
- **Top-selling products** by units sold
- **Low-stock alert** list
- Invoice analytics header with document-level KPIs
- Animated KPI counters on the overview dashboard

### 10.3 Manager Portal & Role-Based Access Control

A dedicated staff portal with its own login and **24 granular permissions** across 8 modules, each supporting create / read / update / delete scoping:

| Module | Permissions |
| :--- | :--- |
| **Catalog** | Products, Categories, Collections |
| **Orders** | B2C Orders, B2B Orders, Dropshipping Orders |
| **Customers** | B2C, B2B, Dropshipping |
| **Documents** | Invoices, Quotes, Receipts |
| **Inquiries** | Wholesale, Dropshipping, Support, Franchise, General |
| **Operations** | Upgrade Requests, HSN, Shipping, Coupons |
| **Content** | Reviews, Website CMS |
| **System** | Settings |

- Manager accounts created and controlled solely by the Admin
- **Active / Suspended** status control
- **Last login and last logout** audit timestamps
- Menu, page and action-level permission enforcement — managers see only what they are authorised for
- Server-side permission verification on every API call (UI hiding alone is never relied upon)

### 10.4 System Settings

- **Company / Seller profile** — legal name, GSTIN, PAN, CIN, address, contact, logo and digital signature (used across all documents)
- **Bank details** and invoice terms & conditions
- **Document ID format designer** — prefix, numbering and padding per document type
- Default tax rate configuration
- COD and online payment toggles
- Footer column and link builder

---

## 11. Notifications & Communications

### 11.1 Multi-Channel Notification System

- **In-app notification centre** with unread badge and popover
- **Browser Web Push notifications** (VAPID) — works even when the site is closed
- **Transactional email** via SMTP
- **Per-user preferences** — customers control email vs. push, and by category: Orders, Shipments, Payments, Quotes, Invoices, Security, System

### 11.2 Event-Driven Automation

A central event dispatcher fires notifications and emails automatically across **28 business events**, including:

Registration & OTP · Welcome · Profile updated · Address added · Password reset & changed · Order created · Order modified · Order cancelled · Order shipped · Order status changed · Payment status changed · Quote generated · Quote accepted/rejected · Invoice generated · Receipt generated · Review submitted · Review moderated · Account upgrade requested/approved/rejected · Coupon live · Inquiry submitted · Inquiry responded · Shipment dispatched.

Each event notifies the **customer** and, where relevant, raises a parallel **admin alert**.

### 11.3 Email Suite

**30 branded, transactional email templates** with PDF document attachments for quotations, receipts and invoices. Includes a **Bulk Email** dispatch tool for admin broadcasts.

---

## 12. Security & Compliance

| Control | Implementation |
| :--- | :--- |
| **Authentication** | Signed JWT sessions stored in `httpOnly` cookies |
| **Password Security** | bcrypt hashing |
| **Brute-Force Protection** | Account auto-locks for 15 minutes after 10 failed login attempts |
| **CSRF Protection** | Double-submit token pattern via `X-CSRF-Token` header |
| **Rate Limiting** | Upstash Redis sliding-window limiter, tiered by endpoint type (auth / general / search) |
| **Input Validation** | Zod schema validation on API inputs |
| **XSS Prevention** | DOMPurify sanitisation of all rich-text/HTML content |
| **Authorisation** | Server-side RBAC verification on every protected route |
| **Payment Integrity** | Server-minted Razorpay order IDs + HMAC-SHA256 signature verification |
| **Order Integrity** | Server-side recomputation of order totals with tolerance checks |
| **Transaction Safety** | MongoDB transactions for atomic multi-document operations |
| **File Upload Security** | Authenticated uploads, MIME-type allowlist, rate limited |
| **Error Monitoring** | Sentry (client + server) |

### Authentication Methods Offered

- Email + password registration and login
- **Google Sign-In (OAuth)**
- **OTP verification** (email) for registration
- Forgot password / reset password via secure tokenised email link
- Separate, isolated **Manager login** portal

---

## 13. Platform & Technical Foundation

### 13.1 Technology Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 16 (App Router) with React 19 |
| Language | TypeScript 5 (strictly typed domain models) |
| Styling | Tailwind CSS v4 with CSS variables + custom theming |
| Database | MongoDB Atlas with Mongoose (19 schemas, weighted text & compound indexes) |
| State Management | Zustand (13 scoped stores) |
| Media Storage | Vercel Blob |
| Caching / Rate Limiting | Upstash Redis |
| Payments | Razorpay |
| Logistics | Shiprocket |
| Email | Nodemailer (SMTP, Gmail-compatible) |
| Push | Web Push (VAPID) |
| Charts | Recharts |
| Animation | Framer Motion |
| Monitoring | Sentry + Vercel Analytics |
| Testing | Vitest + React Testing Library + MSW |

### 13.2 Performance & Reliability

- **ISR (Incremental Static Regeneration)** on storefront pages for fast loads with fresh data
- **Dynamic component imports** and code splitting
- **Next.js image optimisation** with responsive sizing
- **Infinite scroll** and pagination on large catalogues
- **Skeleton loading states** throughout
- Database indexing strategy: text search weights, compound indexes on SKU, barcode, category, status and dates
- Parallel data fetching on server-rendered pages

### 13.3 Progressive Web App (PWA)

- **Installable** on Android, iOS and desktop (standalone app experience)
- **Service worker** with precached core assets
- **Offline fallback page**
- Network-first navigation with stale-while-revalidate for static assets
- Web Push notification support through the service worker

### 13.4 Operations & Maintainability

- **Health-check endpoint** for uptime monitoring
- **System Diagnostics console** — verifies MongoDB connectivity, collection counts and email dispatch end-to-end
- **Sandbox / Mock Mode** — the entire application can run on local storage without a database, for demos and offline prototyping
- **Auto-generating technical documentation** (`npm run update-docs`) that scans models, routes, services and stores
- Automated test suite covering authentication, search, trending logic and API endpoints
- ESLint static analysis and TypeScript build-time type validation
- Structured logging and centralised error boundaries

---

## 14. Deliverables Summary

| Category | Count |
| :--- | ---: |
| Customer-facing storefront pages | 30 |
| Customer account portal screens | 11 |
| Admin control panel modules | 25 |
| Manager portal screens | 22 |
| REST API endpoints | 73 |
| Database collections | 19 |
| Business service modules | 14 |
| Reusable UI components | 20 |
| Automated email templates | 30 |
| Automated business events | 28 |
| Granular staff permissions | 24 |
| Third-party integrations | 6 |

---

*This document describes functionality present in the delivered FlexSell Wholesale codebase.*
