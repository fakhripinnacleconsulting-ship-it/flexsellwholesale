 # FlexSell Wholesale - Enterprise B2B & Dropshipping Platform       
 
FlexSell Wholesale is a next-generation, enterprise-grade B2B e-commerce platform designed for direct manufacturer-to-retailer supply chain networks, bulk ordering, dropshipping fulfillment, and regional tax/logistics distribution. It features multi-tier pricing, SKU-first search algorithms, real-time inventory controls with camera barcode scanning, Razorpay payment verification, Shiprocket logistics dispatch, and an integrated Indian GST taxation engine. 
 
---                 
    
## 📚 Master Documentation 

Complete technical documentation, architecture diagrams, ERD database schemas, REST API endpoints, GST tax rules, and operational guides are available:

- 📖 **Master Markdown File:** [docs/FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md](docs/FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md)
- 🌐 **Interactive Public Portal:** `/documentation`
- 🔄 **Regenerate Documentation Command:** `npm run update-docs`

--- 

## 🎯 Architectural Core & Tech Stack

FlexSell Wholesale bridges the gap between manufacturers/distributors and wholesale retailers or dropshippers. The platform enables multi-tier pricing models, high-volume bulk variant purchases, automated commercial tax invoices, and real-time inventory synchronization.

### Stack Overview:
- **Framework:** Next.js 16.2.10 (App Router with React 19.2.4 & TypeScript 5.0)
- **Styling:** Tailwind CSS v4 with custom CSS variables, smooth transitions, glassmorphism, and dynamic theme customization
- **State Management:** 14 Scoped Zustand stores (`src/stores/`) for client-side state hydration
- **Database & Modeling:** MongoDB Atlas with 17 Mongoose schemas (`src/models/`), weighted text indexes, and compound SKU/barcode indexing
- **Unified B2B Service Layer Pattern:** 13 Centralized client/server service modules (`src/services/`) supporting dual operational modes:
  1. **Live Production API (`isMockMode = false`):** Routes requests to REST API endpoints using `apiClient.ts`.
  2. **Developer Sandbox Mode (`isMockMode = true`):** Persists data arrays directly in `localStorage` for rapid offline feature prototyping.

---

## ✨ Key Application Subsystems

### 1. Multi-Tier B2B Pricing & Variant Matrix
- **Tabular Variant Matrix:** Allows wholesale buyers to view all Color, Size, and Weight combinations in a single matrix and enter order quantities for multiple SKUs simultaneously.
- **Multi-Tier Price Resolution (`priceTierHelper.ts`):** Resolves prices dynamically based on the active customer type (`B2C`, `B2B`, `Dropshipping`), minimum order quantities (MOQ), and volume discounts.

### 2. Indian GST Taxation Engine & Commercial Invoicing
- **Intrastate vs. Interstate Split:** Automatically applies **CGST (9%) + SGST (9%)** for home state shipments (Madhya Pradesh) vs. **IGST (18%)** for out-of-state shipments.
- **B2B Financial Lifecycle:** `Quote (QUO-xxxx)` ➔ `Receipt (RCP-xxxx)` ➔ `Tax Invoice (INV-xxxx)` with HSN tax slab breakdowns.

### 3. Camera Barcode Scanner & Warehouse Audit Ledger
- **Camera Barcode Scanner:** Integrated camera scanning using `html5-qrcode` to scan physical barcodes and adjust stock levels on mobile and desktop browsers.
- **Warehouse Audit Ledger (`StockLog.ts`):** Persisted audit log tracking every inventory modification (manual edits, barcode scans, order deductions, CSV bulk imports).

### 4. Razorpay & Shiprocket Logistics Integrations
- **Razorpay Payments:** Server-side HMAC-SHA256 signature verification in `/api/razorpay/verify`.
- **Shiprocket Dispatch:** Real-time courier serviceability checks, AWB tracking label generation, and automated fulfillment webhooks.

### 5. Security & Authentication Controls
- **JWT & Double-Submit CSRF:** Signed `httpOnly` JWT session tokens and `X-CSRF-Token` headers.
- **Brute-Force Account Lockout:** Automatically locks user accounts for 15 minutes after 10 consecutive failed login attempts.
- **Sliding-Window Rate Limiting:** Upstash Redis rate limiter protecting REST endpoints.

---

## 🗄️ Database Schemas (17 Mongoose Models)

| Collection Model | File Location | Key Responsibilities |
| :--- | :--- | :--- |
| **Product** | `src/models/Product.ts` | Catalog products, `colorVariants`, `subVariants` (SKU, barcode, stock, prices), HSN code, SEO tags. |
| **Customer** | `src/models/Customer.ts` | Accounts (`B2C`, `B2B`, `Dropshipping`), bcrypt passwords, address book, GSTIN, `failedLoginAttempts`. |
| **Order** | `src/models/Order.ts` | B2B orders, line items, shipment details, tax calculations, payment status, state transitions. |
| **Invoice** | `src/models/Invoice.ts` | Tax invoices, quotes, receipts, payment wire instructions, HSN tax breakdown. |
| **Category** | `src/models/Category.ts` | Category hierarchy (`parentId`), slug, image, sorting order. |
| **Collection** | `src/models/Collection.ts` | Manual product lists & smart automated collections with rules (`matchType`, `conditions`). |
| **Coupon** | `src/models/Coupon.ts` | Promotional discounts, min order value, category/product restrictions, usage caps. |
| **StockLog** | `src/models/StockLog.ts` | Warehouse audit ledger logging stock additions, subtractions, and manual adjustments. |
| **Review** | `src/models/Review.ts` | Ratings, review comments, approval moderation status. |
| **HsnRecord** | `src/models/HsnRecord.ts` | Master list of HSN codes and GST rates. |
| **Notification** | `src/models/Notification.ts` | System notification logs and webhook event triggers. |
| **ShippingConfig**| `src/models/ShippingConfig.ts`| Weight slabs and Shiprocket configuration settings. |
| **Inquiry** | `src/models/Inquiry.ts` | B2B custom quote requests and contact messages. |
| **CmsContent** | `src/models/CmsContent.ts` | CMS key-value store for marketing banners, FAQs, footers & blogs. |
| **OtpVerification**| `src/models/OtpVerification.ts`| Email / Mobile OTP verification records. |
| **NotificationPreference**| `src/models/NotificationPreference.ts`| User notification channel preferences. |
| **PushSubscription**| `src/models/PushSubscription.ts`| Browser Web Push VAPID subscriptions. |

---

## 📂 Project Folder Structure

```
flexsell-wholesale/
├── docs/                   # Consolidated Master Documentation & Diagrams
│   ├── FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md
│   └── README.md
├── public/                 # Static branding assets & PWA service worker
├── scripts/                # Utility scripts (update-docs.mjs, etc.)
├── src/
│   ├── app/                # Next.js App Router pages and 63 REST API routes
│   │   ├── (dashboard)/    # Admin and Customer dashboard views
│   │   ├── (storefront)/   # Catalog, product details, checkout, /documentation
│   │   └── api/            # REST API route handlers (/api/products, /api/orders, /api/auth, etc.)
│   ├── components/         # UI Components (Admin, Storefront, Layout, UI primitives)
│   ├── lib/                # Database connection, price helpers, auth guards, validators
│   ├── models/             # 17 Mongoose schemas for MongoDB
│   ├── services/           # 13 Unified B2B Service Modules (Products, Orders, Search, etc.)
│   ├── stores/             # 14 Zustand State Stores (cartStore, authStore, toastStore, etc.)
│   └── types/              # TypeScript interfaces and domain types
├── package.json            # Project dependencies and npm scripts
└── AGENTS.md               # AI agent architectural guidelines & rules
```

---

## 🛠️ Essential Commands

- **Development Server:**
  ```bash
  npm run dev
  ```
  Launches Next.js development server on [http://localhost:3000](http://localhost:3000).

- **Production Build:**
  ```bash
  npm run build
  ```
  Compiles optimized production build bundle and validates TypeScript types.

- **Update Technical Documentation:**
  ```bash
  npm run update-docs
  ```
  Scans codebase models, API routes, services, and stores to regenerate documentation.

- **Run Unit & Integration Tests:**
  ```bash
  npm run test
  ```
  Executes Vitest test suite (`trending.test.ts`, `searchService.test.ts`, `auth.test.ts`, `endpoints.test.ts`).

- **Lint Codebase:**
  ```bash
  npm run lint
  ```
  Runs ESLint static analysis checks across the codebase.
