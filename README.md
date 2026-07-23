# FlexSell Wholesale - Enterprise B2B & Dropshipping Market Platform  
 
FlexSell Wholesale is a next-generation, enterprise-grade B2B e-commerce platform designed for direct manufacturer-to-retailer supply chain networks, bulk ordering, dropshipping fulfillment, and regional tax/logistics distribution. It features advanced variant matrix logic, SKU-first search algorithms, real-time inventory controls with camera barcode scanning, and an integrated Indian GST taxation engine. 

---     
  
## 🎯 Platform Purpose & Architectural Core 

FlexSell Wholesale bridges the gap between manufacturers/distributors and wholesale retailers or dropshippers. The platform enables multi-tier pricing models, high-volume bulk variant purchases, automated commercial tax invoices, and real-time inventory synchronization.

### Key Technical Factors:
- **Framework:** Next.js (App Router, Server Components & Dynamic Client Views)
- **Styling:** Tailwind CSS v4 with CSS custom variables, smooth transitions, glassmorphism, and dynamic theme customization
- **State Management:** Scoped Zustand stores (`src/stores/`) for client-side state hydration
- **Database & Modeling:** MongoDB with Mongoose schemas (`src/models/`), weighted text indexes, and compound SKU/barcode indexing
- **Unified B2B Service Layer Pattern:** Centralized client/server service modules (`src/services/`) supporting dual operational modes:
  1. **Live Production API (`isMockMode = false`):** Routes requests to REST API endpoints using `apiClient.ts`.
  2. **Developer Sandbox Mode (`isMockMode = true`):** Persists data arrays directly in `localStorage` for rapid offline feature prototyping.

---

## ✨ Comprehensive Application Features

### 1. Enterprise Multi-Field Search Service & Live Auto-Suggest
- **SKU-First Priority Engine:** Search queries prioritize exact/partial SKU matches (e.g. `TSH-BLK-XL`), Product IDs (`_id`), and variant barcodes above standard titles, categories, and descriptions.
- **Header Live Auto-Suggest (`GlobalSearchInput.tsx`):** Debounced (200ms) instant auto-complete popup on desktop and mobile headers showing product thumbnails, stock status pills, matching SKUs, and category jump links with full keyboard navigation (Up/Down/Enter/Escape).
- **Exact SKU Match Banner:** Displays a highlighted match banner at the top of the search page when an exact SKU query is detected.
- **Reusable `<ProductSearchPicker>` Modal:** Enables admins and merchants to quickly search and select products/SKUs for Coupons, Manual Collections, and Custom Invoice lines.
- **Database Performance Indexing:** Compound indexes on `colorVariants.subVariants.sku`, `barcode`, `hsnCode`, and a weighted text search index (`title`: 10, `tags`: 5, `seoKeywords`: 3, `description`: 1).

### 2. Algorithmic Trending Products & New Arrivals
- **B2B Category-Balanced Sales Volume Algorithm (`getTrendingProducts`):** Aggregates non-cancelled order items to calculate sales volume per product. Guarantees top product representation for every active category before merging overall high-volume products.
- **Dynamic New Arrivals (`getNewArrivals`):** Queries active products created within the last 7 days. Uses client-side `useEffect` state resolution in [ProductCard.tsx](file:///e:/FAKHRI/flexsell/flexsell-wholesale/src/components/storefront/ProductCard.tsx) to prevent server-client SSR hydration mismatches.

### 3. B2B Bulk Variant Purchase Matrix & Multi-Tier Pricing
- **Tabular Variant Matrix:** Allows wholesale buyers to view all Color, Size, and Weight combinations in a single matrix and enter order quantities for multiple SKUs simultaneously.
- **Multi-Tier Price Resolution (`priceTierHelper.ts`):** Resolves prices dynamically based on the active user customer type (`B2C`, `B2B`, `Dropshipping`), minimum order quantities (MOQ), and volume discounts.

### 4. Indian GST Taxation Engine & Commercial Invoicing
- **Intrastate vs. Interstate Split:** Automatically applies **CGST (9%) + SGST (9%)** for home state shipments (Madhya Pradesh) vs. **IGST (18%)** for out-of-state shipments.
- **HSN Code Tax Summaries:** Groups taxes per HSN slab. Supports inclusive vs. exclusive pricing toggles.
- **Commercial Tax PDF Invoices & Quotes:** Print-optimized stylesheets for generating commercial PDF invoices and instant cart quotes without external heavy PDF libraries.

### 5. Warehouse Inventory & Camera Barcode Scanner
- **Camera Barcode Scanner:** Integrated camera scanning using `html5-qrcode` on mobile and desktop browsers to scan physical barcodes and adjust stock levels on the fly.
- **Code 39 SVG Encoder:** Browser-side generator that converts SKUs into scannable SVG barcodes.
- **Warehouse Audit Ledger (`StockLog.ts`):** Persisted log tracking every inventory change (manual edits, barcode scans, order deductions, CSV bulk imports).
- **CSV Bulk Import/Export:** Export stock levels to CSV, make bulk edits in spreadsheet software, and re-import to update warehouse stock.

### 6. Unified Service Layer Subsystems
- **Customer Addresses (`customerService.ts`):** Shipping/billing address management with mock fallback key `"flexsell-addresses-storage"`.
- **Product Reviews & Moderation (`reviewService.ts`):** Customer ratings/reviews submission and admin moderation with mock key `"flexsell-reviews-storage"`.
- **Commercial Coupons (`couponService.ts`):** Coupon creation, category/product eligibility validation, and discount calculation with mock key `"flexsell-coupons-storage"`.
- **Notifications & Webhooks (`notificationService.ts`):** Real-time activity alerts and webhook integrations under mock keys `"flexsell-notifications-storage"` and `"flexsell-webhooks-storage"`.
- **Inquiries (`inquiryService.ts`):** B2B wholesale bulk quote request handling under mock key `"flexsell-inquiries-storage"`.
- **HSN Records (`hsnService.ts`):** Master HSN tax slab management under mock key `"flexsell-hsn-storage"`.

---

## 🗄️ Database Schemas & Data Models

| Collection Model | File Location | Key Responsibilities |
| :--- | :--- | :--- |
| **Product** | `src/models/Product.ts` | Product catalog, `colorVariants`, `subVariants` (SKU, barcode, stock, prices), HSN code, SEO tags, search indexes. |
| **Category** | `src/models/Category.ts` | Category hierarchy (`parentId`), slug, image, sorting order. |
| **Collection** | `src/models/Collection.ts` | Manual product lists & smart automated collections with rules (`matchType`, `conditions`). |
| **Order** | `src/models/Order.ts` | B2B orders, line items, shipment details, tax calculations, payment status, history logs. |
| **Customer** | `src/models/Customer.ts` | Account roles (`admin`, `customer`), customer types (`B2C`, `B2B`, `Dropshipping`), company details, GSTIN. |
| **Coupon** | `src/models/Coupon.ts` | Promotional discounts, min order value, category/product restrictions, usage caps. |
| **Invoice** | `src/models/Invoice.ts` | Tax invoice generation, payment wire instructions, HSN tax breakdown. |
| **StockLog** | `src/models/StockLog.ts` | Warehouse audit ledger logging stock additions, subtractions, and manual adjustments. |
| **Review** | `src/models/Review.ts` | Ratings, review comments, approval moderation status. |
| **Notification** | `src/models/Notification.ts` | System notification logs and webhook event triggers. |
| **HsnRecord** | `src/models/HsnRecord.ts` | Master list of HSN codes and GST rates. |
| **Inquiry** | `src/models/Inquiry.ts` | B2B custom quote requests and contact messages. |

---

## 📂 Project Folder Structure

```
flexsell-wholesale/
├── public/                 # Static branding assets & logos
├── src/
│   ├── app/                # Next.js App Router pages and API routes
│   │   ├── (dashboard)/    # Admin, Merchant, and Buyer dashboard routes
│   │   ├── (storefront)/   # Storefront catalog, search, product details, checkout
│   │   └── api/            # REST API endpoints (/api/products, /api/search, /api/auth, etc.)
│   ├── components/         # Modularized UI components
│   │   ├── admin/          # Product forms, inventory grid, theme editor, ProductSearchPicker
│   │   ├── storefront/     # Catalog views, GlobalSearchInput, SearchResults, ProductCard
│   │   ├── layout/         # Header with MegaMenu, Footer, Mobile Drawer
│   │   └── ui/             # Reusable UI primitives (Button, Input, Card, Drawer, PriceDisplay)
│   ├── config/             # Base configurations and default theme values
│   ├── lib/                # Database connection (dbConnect.ts), apiClient, price tier helpers, validators
│   ├── models/             # Mongoose database models and schema indexes
│   ├── services/           # Unified B2B Service Layer (Search, Products, Addresses, Coupons, Reviews)
│   ├── stores/             # Zustand state managers (cartStore, productStore, authStore, toastStore)
│   └── types/              # Unified TypeScript definitions and interfaces
├── tsconfig.json           # TypeScript configuration
├── package.json            # Project dependencies and script shortcuts
└── AGENTS.md               # AI agent guidelines and architectural conventions
```

---

## 🛠️ Essential Development Commands

- **Development Server:**
  ```bash
  npm run dev
  ```
  Starts Next.js development server with Turbopack on [http://localhost:3000](http://localhost:3000).

- **Production Build:**
  ```bash
  npm run build
  ```
  Compiles optimized production build bundle and validates TypeScript types.

- **Start Production Server:**
  ```bash
  npm run start
  ```
  Launches compiled production server.

- **Run Unit & Integration Tests:**
  ```bash
  npm run test
  ```
  Executes Vitest test suite (`trending.test.ts`, `searchService.test.ts`, `auth.test.ts`, etc.).

- **Lint Codebase:**
  ```bash
  npm run lint
  ```
  Runs ESLint static analysis checks across all components and services.
"# flexsellwholesale" 
