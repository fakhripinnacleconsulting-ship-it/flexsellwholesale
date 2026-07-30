# FlexSell Wholesale - Comprehensive Project Architecture & Directory Map

> **PROJECT.md** - Complete guide to directory structure, technical architecture, features, and file locations for **FlexSell Wholesale B2B E-Commerce Platform**.

---

## 📌 Project Overview

**FlexSell Wholesale** is an enterprise-grade B2B E-Commerce and Wholesale Management application built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand state management, and MongoDB / Mongoose.

---

## 🛠️ Technical Stack & Key Libraries

- **Framework:** Next.js 16 (App Router, dynamic SSR/SSG rendering)
- **Language:** TypeScript 5
- **UI & Styling:** Tailwind CSS v4, Framer Motion, Lucide React, Embla Carousel
- **State Management:** Zustand v5 (scoped client stores)
- **Database:** MongoDB with Mongoose v9
- **Authentication:** Custom JWT & Bcrypt based authentication (`src/lib/auth.ts`)
- **API Services:** Unified B2B Service Layer with Mock Mode (LocalStorage fallback) & REST API client
- **Payment & Logistics:** Razorpay integration, Shiprocket API integration
- **Utilities & Tools:** ExcelJS (export/import), JSBarcode & HTML5-QRCode (barcode operations), Web Push Notifications, Upstash Redis (rate limiting), Vitest (testing)

---

## 📁 Root Directory Structure Map

```
flexsellwholesale/
├── .env                      # Environment variables configuration
├── .gitignore                # Git ignored paths
├── AGENTS.md                 # Architecture guidelines & rules for AI agents
├── CLAUDE.md                 # Quick reference developer guide
├── PROJECT.md                # (This file) Complete project directory & architecture guide
├── README.md                 # Project introduction & setup instructions
├── docs/                     # Detailed technical & API documentation
├── next.config.ts            # Next.js build & runtime configuration
├── package.json              # Project dependencies, scripts & metadata
├── postcss.config.mjs        # PostCSS configuration for Tailwind CSS v4
├── public/                   # Static public assets (images, icons, uploads)
├── scripts/                  # Maintenance & automated doc generation scripts
├── src/                      # Application source code
├── tsconfig.json             # TypeScript configuration
└── vitest.config.ts          # Vitest unit & integration test configuration
```

---

## 📂 Detailed Source Directory (`src/`) Overview

The `src/` directory contains all application logic divided into modular directories:

```
src/
├── app/          # Next.js App Router (Pages, Layouts & REST API Endpoints)
├── components/   # UI & Feature Components
├── config/       # Global configuration & preset page contents
├── hooks/        # Custom React Hooks
├── lib/          # Helper utilities, database connection, security & PDF/Print helpers
├── models/       # Mongoose Schemas & Database Models
├── providers/    # React Context & Theme Providers
├── proxy.ts      # Custom server request proxy middleware replacement
├── scripts/      # Client-side / execution scripts
├── services/     # B2B Unified Client Service Layer (Live API + Mock Mode)
├── stores/       # Zustand State Management Stores
└── types/        # Centralized TypeScript Type & Interface Definitions
```

---

## 🗂️ In-Depth Breakdown of Subdirectories

### 1. `src/app/` (Next.js App Router & API Routes)
Routing structure follows Next.js Route Groups `(storefront)` and `(dashboard)` for clean separation of concerns.

* **`(storefront)/`** - Public Wholesale Storefront & B2B Customer Portal
  * `page.tsx`: Home Page / Hero Banner / Featured Catalog
  * `about/`: Company profile & B2B story
  * `blogs/`: Articles & news
  * `cart/`: Bulk shopping cart view
  * `categories/`: Category listing & catalog filters
  * `checkout/`: Multi-tier B2B checkout process
  * `collections/`: Curated product collections
  * `contact/`: Customer support contact page
  * `documentation/`: Developer & API documentation view
  * `dropshipping/`: Dropshipping portal & registration
  * `faq/`: Frequently Asked Questions
  * `login/` & `register/` & `forgot-password/` & `reset-password/`: Authentication views
  * `order-confirmation/` & `order-tracking/`: Order lifecycle tracking
  * `policies/`: Privacy, Terms, Refund & Shipping policies
  * `products/`: Product listing & detailed product view (`[slug]`, `[id]`)
  * `quote/`: B2B Bulk Price Quotation request form
  * `search/`: Global product & category search results
  * `system-diagnostics/`: System health & API testing tool
  * `wishlist/`: Saved favorite products

* **`(dashboard)/`** - Protected Dashboards
  * **`admin/`** - Full Admin Portal & Store Operations
    * `analytics/`: Sales, order metrics & revenue charts
    * `announcements/`: Store banner announcements manager
    * `banners/`: Homepage carousel & promotional banner editor
    * `blogs/`: Blog posts CMS editor
    * `categories/`: Hierarchical Category management
    * `cms/`: Static page content editor
    * `collections/`: Collections & product tag manager
    * `coupons/`: Discount code & B2B coupon management
    * `customers/`: Customer profiles & KYC verification status
    * `hsn/`: HSN Code & GST rate manager
    * `inquiries/`: Customer quotation requests & messages
    * `invoices/`: GST Invoices & B2B Billing generator
    * `orders/`: Master order fulfillment & status workflow
    * `pages/`: Custom landing pages
    * `products/`: Product inventory manager, variant pricing & stock update
    * `reviews/`: Product review moderation
    * `settings/`: Store settings & currency preferences
    * `shipping/`: Shipping rules & Shiprocket settings
    * `theme/`: Storefront visual theme customizer
    * `upgrade-requests/`: Tier upgrade applications (Wholesale/Dropshipper approval)
  * **`client/`** - B2B Buyer Dashboard
    * `addresses/`: Saved delivery & billing addresses
    * `coupons/`: Available bulk purchase discount codes
    * `notifications/`: Account alerts & order status updates
    * `orders/`: Purchase history & invoice downloads
    * `profile/`: Account settings & GSTIN/KYC details
    * `reviews/`: Submitted product reviews
    * `support/`: Ticket submission & customer support
    * `upgrade/`: Application form for Wholesale / VIP Buyer tiers
    * `wishlist/`: Saved buyer lists

* **`api/`** - Backend Server Endpoints (REST API)
  * `admin/`: Admin auth, settings & batch management APIs
  * `auth/`: Login, register, token refresh, OTP verification
  * `categories/` & `collections/` & `products/`: Catalog CRUD endpoints
  * `cms/` & `blogs/` & `inquiries/`: Content & inquiry handlers
  * `coupons/` & `customers/` & `reviews/`: Customer & promotion endpoints
  * `health/`: API health check endpoint
  * `hsn/` & `invoices/`: Tax calculation & GST invoice generation
  * `inventory/` & `orders/`: Inventory updates & order placement
  * `notifications/` & `push/`: Browser push notification registration & triggers
  * `razorpay/` & `shiprocket/`: Payment gateway webhooks & shipping automation
  * `search/` & `upload/`: Search query handler & file upload handler

---

### 2. `src/services/` (Unified B2B Service Layer)
All dynamic client-side state interactions route through service wrappers supporting **Mock Mode (`isMockMode`)** via LocalStorage fallback and **Live API mode** via `apiClient`:

* `customerService.ts`: Customer profile & address management (`"flexsell-addresses-storage"`)
* `reviewService.ts`: Product reviews & moderation (`"flexsell-reviews-storage"`)
* `couponService.ts`: Coupon validation & redemptions (`"flexsell-coupons-storage"`)
* `notificationService.ts`: Account notifications (`"flexsell-notifications-storage"`)
* `productService.ts`: Product fetching & catalog filters
* `orderService.ts`: B2B Order creation & cancellation
* `invoiceService.ts`: Invoice generation & printable views
* `categoryService.ts`, `collectionService.ts`, `hsnService.ts`, `searchService.ts`, `shippingService.ts`, `shiprocketService.ts`, `barcodeResolver.ts`

---

### 3. `src/stores/` (Zustand State Stores)
Global client state management organized by feature domains:

* `authStore.ts`: Authenticated user, role, token & session state
* `cartStore.ts`: B2B Shopping cart items, bulk quantity discounts, tier pricing
* `productStore.ts` & `categoryStore.ts` & `collectionStore.ts`: Catalog cache stores
* `orderStore.ts` & `invoiceStore.ts`: Selected order & invoice states
* `wishlistStore.ts`: Saved customer products
* `themeStore.ts`: Light / Dark mode & custom theme settings
* `toastStore.ts`: Global notification popups / alerts
* `hsnStore.ts`, `inventoryHistoryStore.ts`, `dashboardViewStore.ts`, `confirmStore.ts`

---

### 4. `src/models/` (Mongoose Schemas for MongoDB)

* `Product.ts`: Product schema, variants, wholesale pricing tiers, stock
* `Category.ts`: Category tree structure & metadata
* `Collection.ts`: Curated collection definitions
* `Customer.ts`: Buyer details, GSTIN, business type, KYC approval
* `Order.ts`: Order details, shipping address, payment status, tracking
* `Invoice.ts`: GST Tax Invoice records, HSN breakdown
* `Coupon.ts`: Coupon discount rules & validity
* `Review.ts`: Rating, buyer feedback & approval status
* `Notification.ts` & `NotificationPreference.ts`: Notification records
* `ShippingConfig.ts`, `HsnRecord.ts`, `Inquiry.ts`, `CmsContent.ts`, `StockLog.ts`, `PushSubscription.ts`, `OtpVerification.ts`

---

### 5. `src/components/` (UI & Feature Components)

* `admin/`: Admin dashboard widgets (Barcode scanner, bulk price update, product form, CMS editor, inventory tables)
* `storefront/`: Public storefront widgets (Hero banner carousel, catalog grids, product detail view, cart sidebar, quick view modal)
* `layout/`: Header, Footer, Mega Menu, Client Sidebar, Mobile Bottom Navigation, Notification Popover
* `ui/`: Reusable design system primitives (Button, Card, Input, Badge, Modal, Drawer, Breadcrumb, Toast, AnimatedCounter, PriceDisplay)
* `documents/`: Print-ready templates for Invoices, Quotes & Shipping Labels (with `@media print` styling)
* `auth/`, `common/`, `dropshipping/`: Dedicated feature component sets

---

### 6. `src/lib/` (Core Libraries & Utility Helpers)

* `apiClient.ts`: Axios/Fetch wrapper supporting API base URL & Mock mode toggle
* `dbConnect.ts`: MongoDB connection singleton
* `auth.ts` & `authGuard.ts`: JWT verification, password hashing & route protection
* `priceTierHelper.ts`: B2B Tier pricing calculation (Wholesale vs Retail vs Volume discount)
* `excelHelper.ts` & `pdfPrintHelper.ts`: Data export & document printing helpers
* `barcodeHelper.ts` & `usbScannerListener.ts`: Barcode generation & hardware scanner support
* `emailService.ts`: Transactonal emails (Order confirmation, invoice PDF email)
* `rateLimit.ts` & `csrf.ts` & `sanitize.ts`: Security, rate limiting & input sanitization
* `seo.ts` & `seoKeywordEngine.ts`: Automated SEO meta tags & structured JSON-LD schemas
* `shiprocketClient.ts` & `gtm.ts` & `browserNotifications.ts`

---

### 7. `src/config/`, `src/types/`, `src/providers/`

* `src/config/theme.config.ts`: Color schemes, typography presets & layout tokens
* `src/config/pagesContent.ts`: Default content for static storefront pages
* `src/types/index.ts`: Unified TypeScript types (Product, Order, Customer, Invoice, Cart, Coupon, etc.)
* `src/providers/ThemeProvider.tsx`: Next-themes provider for theme switching

---

## ⚡ Quick Reference Commands

| Task | Command |
|---|---|
| **Development Server** | `npm run dev` |
| **Production Build** | `npm run build` |
| **Start Production** | `npm run start` |
| **Linting** | `npm run lint` |
| **Run Unit Tests** | `npm run test` |
| **Update Docs** | `npm run update-docs` |

---

*This file should be updated whenever major directory changes or new architectural patterns are introduced.*
