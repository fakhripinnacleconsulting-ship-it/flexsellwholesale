# FlexSell Wholesale — Master Technical Documentation Suite

> **Application Version:** 0.1.0  
> **Framework:** Next.js 16.2.10 (App Router) | React 19.2.4 | TypeScript 5.0  
> **Database:** MongoDB Atlas (Mongoose 9.7.4)  
> **Architecture:** Decoupled Unified Service Layer with Offline Sandbox & Live REST APIs  

---

# TABLE OF CONTENTS
1. [PRODUCT OVERVIEW & PERSONA SEGMENTS](#1-product-overview--persona-segments)
2. [TECHNOLOGY STACK INVENTORY](#2-technology-stack-inventory)
3. [SYSTEM ARCHITECTURE & DIAGRAM](#3-system-architecture--diagram)
4. [PROJECT STRUCTURE & FILE LAYOUT](#4-project-structure--file-layout)
5. [APPLICATION ROUTES SPECIFICATION](#5-application-routes-specification)
6. [DATABASE SCHEMA & ERD DIAGRAM (17 MODELS)](#6-database-schema--erd-diagram-17-models)
7. [AUTHENTICATION, LOCKOUT & AUTH FLOW DIAGRAM](#7-authentication-lockout--auth-flow-diagram)
8. [PRODUCT CATALOG & MULTI-TIER PRICING ARCHITECTURE](#8-product-catalog--multi-tier-pricing-architecture)
9. [ATOMIC INVENTORY MANAGEMENT & AUDIT LEDGER](#9-atomic-inventory-management--audit-ledger)
10. [CART & INDIAN GST TAX ENGINE FLOW DIAGRAM](#10-cart--indian-gst-tax-engine-flow-diagram)
11. [ORDER FULFILLMENT STATE MACHINE DIAGRAM](#11-order-fulfillment-state-machine-diagram)
12. [QUOTE ➔ RECEIPT ➔ INVOICE B2B LIFECYCLE DIAGRAM](#12-quote--receipt--invoice-b2b-lifecycle-diagram)
13. [RAZORPAY PAYMENT INTEGRATION & HMAC SEQUENCE DIAGRAM](#13-razorpay-payment-integration--hmac-sequence-diagram)
14. [SHIPROCKET LOGISTICS & FULFILLMENT DIAGRAM](#14-shiprocket-logistics--fulfillment-diagram)
15. [EVENT DISPATCHER & NOTIFICATION FLOW DIAGRAM](#15-event-dispatcher--notification-flow-diagram)
16. [ADMINISTRATIVE DASHBOARD MODULES (18 MODULES)](#16-administrative-dashboard-modules-18-modules)
17. [REST API ENDPOINT REFERENCE (23 DOMAINS)](#17-rest-api-endpoint-reference-23-domains)
18. [SERVICES & BUSINESS LOGIC LAYER (13 SERVICES)](#18-services--business-logic-layer-13-services)
19. [STATE MANAGEMENT ARCHITECTURE (14 ZUSTAND STORES)](#19-state-management-architecture-14-zustand-stores)
20. [CONTENT MANAGEMENT SYSTEM (CMS) ARCHITECTURE](#20-content-management-system-cms-architecture)
21. [EXCEL & BULK DATA OPERATIONS](#21-excel--bulk-data-operations)
22. [TESTING STRATEGY & TEST SUITE COVERAGE](#22-testing-strategy--test-suite-coverage)
23. [SECURITY CONTROL MATRIX & CRYPTOGRAPHY](#23-security-control-matrix--cryptography)
24. [DEPLOYMENT, PWA & SYSTEM HEALTH MONITORING](#24-deployment-pwa--system-health-monitoring)
25. [ENVIRONMENT VARIABLES REFERENCE](#25-environment-variables-reference)
26. [ERROR HANDLING ARCHITECTURE](#26-error-handling-architecture)
27. [TROUBLESHOOTING & OPERATIONAL DIAGNOSTICS](#27-troubleshooting--operational-diagnostics)
28. [KNOWN ISSUES & TECHNICAL DEBT ANALYSIS](#28-known-issues--technical-debt-analysis)

---

# 1. PRODUCT OVERVIEW & PERSONA SEGMENTS

FlexSell Wholesale is an all-in-one B2B, B2C, and Dropshipping e-commerce platform engineered specifically for Indian manufacturers, importers, wholesale distributors, and resellers.

## Target Persona Segments
1. **B2B Buyers (Wholesale Merchants):** Bulk pricing tiers, per-variant MOQs, formal quotation requests, and GST tax invoices with buyer GSTINs.
2. **B2C Consumers:** Single-unit retail shopping, instant Razorpay/UPI payments, and shipment tracking.
3. **Dropshippers (Resellers):** Resellers order directly to end-customer shipping addresses with packing slips omitting wholesale cost info.
4. **Platform Administrators:** Inventory management, camera barcode scanning, Shiprocket automated dispatch, and CMS controls.

---

# 2. TECHNOLOGY STACK INVENTORY

| Category | Technology | Version | Purpose |
|:---------|:-----------|:--------|:--------|
| Framework | Next.js (App Router) | 16.2.10 | Full-stack React framework |
| UI Engine | React / React DOM | 19.2.4 | Component rendering |
| Language | TypeScript | 5.0+ | Type safety across stack |
| Database | MongoDB / Mongoose | 9.7.4 | Document storage & ODM |
| State Management | Zustand | 5.0.14 | Scoped client stores |
| Payment Gateway | Razorpay SDK | 2.9.8 | Online orders & HMAC verification |
| Logistics | Shiprocket Client | Custom | Courier serviceability & AWB labels |
| Rate Limiting | Upstash Redis | 1.38.0 | Sliding-window API rate limits |
| Testing | Vitest | 4.1.10 | Unit testing framework |

---

# 3. SYSTEM ARCHITECTURE & DIAGRAM

FlexSell Wholesale is organized into 4 distinct architectural layers:

```mermaid
graph TD
    Client["Browser Client / React 19 UI"]
    Zustand["Zustand Client Stores"]
    Services["Unified Service Layer (Mock / Live Proxy)"]
    API["Next.js App Router Server APIs (/api/*)"]
    AuthGuard["Auth Guard & CSRF Middleware"]
    DB[("MongoDB Atlas Database")]
    Razorpay["Razorpay Gateway"]
    Shiprocket["Shiprocket Logistics"]
    VercelBlob["Vercel Blob Storage"]
    SMTP["Nodemailer SMTP"]

    Client -->|Actions & Selectors| Zustand
    Client -->|Method Calls| Services
    Services -->|HTTP Requests + CSRF| API
    API -->|Validate Token & CSRF| AuthGuard
    AuthGuard -->|Mongoose Queries| DB
    API -->|Create Payment / Verify HMAC| Razorpay
    API -->|Fulfill & Label Generation| Shiprocket
    API -->|Media Uploads| VercelBlob
    API -->|Send Notifications| SMTP
```

---

# 4. PROJECT STRUCTURE & FILE LAYOUT

- `src/app/(storefront)` — Public retail and wholesale buyer pages.
- `src/app/(dashboard)/admin` — Administrative management dashboard.
- `src/app/(dashboard)/client` — Customer account & order tracking portal.
- `src/app/api/` — REST API controllers (23 domain routes).
- `src/services/` — Unified client-side service wrappers with mock mode support.
- `src/stores/` — Zustand client state stores.
- `src/models/` — 17 Mongoose schemas for MongoDB.

---

# 5. APPLICATION ROUTES SPECIFICATION

- `/` — Storefront homepage featuring CMS banners, categories, trending products & new arrivals.
- `/products` — Catalog listing with category filters, price sorting, tag search & pagination.
- `/products/[slug]` — Product detail page with variant selector, B2B price tiers, A+ content & JSON-LD schema.
- `/quote` — B2B bulk quotation request form for negotiated wholesale orders.
- `/checkout` — Multi-step checkout with coupon validation, GST calculation & Razorpay payment.
- `/client?view=orders` — Customer order tracking timeline, invoices, receipts & profile settings.
- `/admin` — 18-module administrative dashboard for orders, products, CMS & analytics.
- `/api/health` — System health check monitoring MongoDB connection state.

---

# 6. DATABASE SCHEMA & ERD DIAGRAM (17 MODELS)

## Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    Customer ||--o{ Order : places
    Customer ||--o{ SavedAddress : owns
    Customer ||--o{ Review : writes
    
    Category ||--o{ Product : classifies
    Collection ||--o{ Product : contains
    HsnRecord ||--o{ Product : applies_tax
    
    Product ||--o{ ColorVariant : contains
    ColorVariant ||--o{ SubVariant : contains
    Product ||--o{ StockLog : logs_change
    
    Order ||--|{ OrderItem : contains
    Order ||--o| Invoice : generates
    
    Coupon ||--o{ Order : discounts
    ShippingConfig ||--o{ Order : calculates_shipping
```

## Primary Schemas
1. `Customer`: B2C, B2B, Dropshipper accounts, bcrypt passwords, addresses, GSTINs, `failedLoginAttempts`.
2. `Product`: Catalog items, color variants, subvariant matrix (Size x Weight x Price Tiers), HSN codes, barcodes.
3. `Order`: Purchase orders, items, shipping address, payment status (`Pending`, `Paid`), status transitions.
4. `Invoice`: B2B documents: Quotes (`QUO-xxxx`), Receipts (`RCP-xxxx`), and Tax Invoices (`INV-xxxx`).
5. `Category`: Hierarchical taxonomy categories.
6. `Collection`: Manual or smart product groupings.
7. `Coupon`: Discount vouchers (flat/percentage, expiry, minOrderValue).
8. `HsnRecord`: HSN master codes and GST rates.
9. `StockLog`: Inventory movement logs (`productId`, `sku`, `oldStock`, `newStock`, `reason`, `updatedBy`).

---

# 7. AUTHENTICATION, LOCKOUT & AUTH FLOW DIAGRAM

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User
    participant API as Next.js Login API (/api/auth/login)
    participant Limiter as Rate Limiter (Upstash / Memory)
    participant DB as MongoDB Atlas (Customer Model)
    participant Bcrypt as Bcrypt Comparator

    User->>API: POST /api/auth/login (identifier, password)
    API->>Limiter: Check IP rate limit (auth: 5/min)
    alt Rate Limit Exceeded
        Limiter-->>User: Return 429 Too Many Requests
    end
    API->>DB: findOne({ email OR _id })
    alt Account Locked (lockUntil > now)
        API-->>User: Return 423 Account Locked (15 Mins)
    end
    API->>Bcrypt: compare(password, hashed_password)
    alt Password Mismatch
        API->>DB: Increment failedLoginAttempts (+1)
        alt failedLoginAttempts >= 10
            API->>DB: Set lockUntil = now() + 15 mins
        end
        Bcrypt-->>User: Return 401 Invalid Credentials
    end
    API->>DB: Reset failedLoginAttempts = 0, lockUntil = null
    API-->>User: Set httpOnly JWT token & csrf_token Cookies (200 OK)
```

---

# 8. PRODUCT CATALOG & MULTI-TIER PRICING ARCHITECTURE

Products contain nested **Color Variants** and **SubVariants**:
- **SubVariant Matrix:** Size, Weight, MRP, B2C Price, B2B Price, Dropshipping Price, Stock, SKU, Barcode.
- **Price Resolution (`priceTierHelper.ts`):**
  - `B2C`: Applies `b2cPrice`.
  - `B2B`: Applies `b2bPrice` if set and MOQ met, fallback `b2cPrice`.
  - `Dropshipping`: Applies `dropshippingPrice` if set, fallback `b2cPrice`.

---

# 9. ATOMIC INVENTORY MANAGEMENT & AUDIT LEDGER

- Subvariant stock is atomically decremented during checkout via MongoDB `$inc: -quantity` queries.
- Order cancellations trigger matching `$inc: +quantity` restocking updates.
- All manual stock adjustments in Admin Inventory generate a `StockLog` audit ledger entry.

---

# 10. CART & INDIAN GST TAX ENGINE FLOW DIAGRAM

```mermaid
flowchart TD
    Start([User Initiates Checkout]) --> AddItems[Cart Store Items Loaded]
    AddItems --> CheckBuyerState{Buyer State == Seller State?}
    
    CheckBuyerState -- Yes --> Intrastate[Intrastate Transaction]
    CheckBuyerState -- No --> Interstate[Interstate Transaction]

    Intrastate --> CalcIntraTax[Calculate Base Amount & Total GST]
    CalcIntraTax --> SplitCGST[CGST = Total GST / 2]
    CalcIntraTax --> SplitSGST[SGST = Total GST / 2]

    Interstate --> CalcInterTax[Calculate Base Amount & Total GST]
    CalcInterTax --> AssignIGST[IGST = Total GST]

    SplitSGST --> CombineBreakdown[Group HSN Slabs & Subtotal]
    AssignIGST --> CombineBreakdown
    CombineBreakdown --> PayOrder([Initiate Order Submission])
```

---

# 11. ORDER FULFILLMENT STATE MACHINE DIAGRAM

```mermaid
stateDiagram-v2
    [*] --> Placed : Order Submitted
    Placed --> Pending : Awaiting Payment Validation
    Placed --> Cancelled : Customer / Admin Cancels
    
    Pending --> Confirmed : Payment Verified / COD Confirmed
    Confirmed --> Processing : Stock Atomically Deducted
    Processing --> AwaitingShipment : Packed & Label Generated
    
    AwaitingShipment --> Shipped : Dispatched via Courier
    Shipped --> InTransit : Courier Updates AWB Status
    InTransit --> Delivered : Delivery Confirmed
    
    Delivered --> [*]
    Cancelled --> [*]
```

---

# 12. QUOTE ➔ RECEIPT ➔ INVOICE B2B LIFECYCLE DIAGRAM

```mermaid
flowchart TD
    Buyer([B2B Buyer Request]) --> CreateQuote[Create Draft Quote QUO-xxxx]
    CreateQuote --> AdminReview[Admin Finalizes Quote Rates]
    AdminReview --> BuyerAccept[Buyer Accepts Quote]
    BuyerAccept --> CreateOrder[Convert Quote to Active Order]
    
    CreateOrder --> CheckPayment{Payment Status?}
    
    CheckPayment -- Pending / COD --> GenReceipt[Generate Receipt RCP-xxxx]
    CheckPayment -- Paid --> GenInvoice[Generate Tax Invoice INV-xxxx]

    GenInvoice --> ImmutableRecord([Immutable GST Tax Record Preserved])
```

---

# 13. RAZORPAY PAYMENT INTEGRATION & HMAC SEQUENCE DIAGRAM

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant UI as CheckoutView.tsx
    participant API as Razorpay API (/api/razorpay/*)
    participant Razorpay as Razorpay Gateway
    participant DB as MongoDB Atlas

    Customer->>UI: Select Razorpay & Click Place Order
    UI->>API: POST /api/razorpay/order (amount)
    API->>Razorpay: razorpay.orders.create({ amount })
    Razorpay-->>UI: Return orderId
    UI->>Razorpay: Open Razorpay Modal (orderId)
    Customer->>Razorpay: Complete Payment (Card/UPI/NetBanking)
    Razorpay-->>UI: Return razorpay_payment_id & razorpay_signature
    UI->>API: POST /api/razorpay/verify (order_id, payment_id, signature)
    API->>API: Compute HMAC-SHA256 signature
    alt Signature Valid
        API-->>UI: Return 200 Success Verified
        UI->>DB: Save Order & Create Tax Invoice (INV-xxxx)
    else Signature Invalid
        API-->>UI: Return 400 Signature Mismatch
    end
```

---

# 14. SHIPROCKET LOGISTICS & FULFILLMENT DIAGRAM

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant AdminUI as Admin Orders Tab
    participant ShipAPI as Shiprocket API (/api/shiprocket/*)
    participant Shiprocket as External Shiprocket API
    participant DB as MongoDB Atlas

    Admin->>AdminUI: Select Order & Click Fulfill with Shiprocket
    AdminUI->>ShipAPI: POST /api/shiprocket/serviceability (postcode, weight)
    ShipAPI->>Shiprocket: GET /v1/external/courier/serviceability
    Shiprocket-->>AdminUI: Return Couriers & Shipping Rates
    Admin->>AdminUI: Confirm Dispatch
    ShipAPI->>Shiprocket: POST /v1/external/orders/create/adhoc
    ShipAPI->>Shiprocket: POST /v1/external/courier/generate/awb
    Shiprocket-->>ShipAPI: Return AWB Code & Label URL
    ShipAPI->>DB: Update Order status="Shipped", shipmentDetails
```

---

# 15. EVENT DISPATCHER & NOTIFICATION FLOW DIAGRAM

```mermaid
flowchart TD
    Trigger([Domain Action Triggered e.g. ORDER_CREATED]) --> Dispatcher[eventDispatcher.ts]
    
    Dispatcher --> Handler1[eventHandlers.ts]
    Dispatcher --> Handler2[webhookDispatcher.ts]
    Dispatcher --> Handler3[pushServiceServer.ts]

    Handler1 --> Nodemailer[Nodemailer SMTP Gateway]
    Handler2 --> SignHMAC[Sign Payload Header X-Flexsell-Signature]
    Handler3 --> PushService[web-push VAPID Service]

    Nodemailer --> CustomerEmail([Customer Email Inbox])
    SignHMAC --> ExternalSystem([External Webhook Endpoint])
    PushService --> BrowserPush([Browser Push Notification])
```

---

# 16. ADMINISTRATIVE DASHBOARD MODULES (18 MODULES)

18 modules including: Overview, Products, Inventory, Orders, Invoices, Categories, Collections, Coupons, Customers, HSN, Reviews, CMS, Shipping Settings, and Theme Customizer.

---

# 17. REST API ENDPOINT REFERENCE (23 DOMAINS)

- Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`.
- Products: `GET /api/products`, `POST /api/products`, `POST /api/products/import`, `GET /api/products/export`.
- Orders: `GET /api/orders`, `POST /api/orders`, `PUT /api/orders/[id]/status`.
- Payments: `POST /api/razorpay/order`, `POST /api/razorpay/verify`.
- Logistics: `POST /api/shiprocket/serviceability`, `POST /api/shiprocket/fulfill`, `POST /api/shiprocket/webhook`.
- Diagnostics: `GET /api/health`.

---

# 18. SERVICES & BUSINESS LOGIC LAYER (13 SERVICES)

Unified service layer: `productService`, `orderService`, `customerService`, `invoiceService`, `categoryService`, `collectionService`, `couponService`, `reviewService`, `searchService`, `hsnService`, `shippingService`, `shiprocketService`, `notificationService`.

---

# 19. STATE MANAGEMENT ARCHITECTURE (14 ZUSTAND STORES)

Stores: `cartStore`, `authStore`, `productStore`, `orderStore`, `invoiceStore`, `categoryStore`, `collectionStore`, `hsnStore`, `inventoryHistoryStore`, `themeStore`, `wishlistStore`, `toastStore`, `confirmStore`, `dashboardViewStore`.

---

# 20. CONTENT MANAGEMENT SYSTEM (CMS) ARCHITECTURE

CMS Content Key-Value Store (`CmsContent`) managing hero banners, FAQs, trust stats, footers, blogs, testimonials, and policy documents.

---

# 21. EXCEL & BULK DATA OPERATIONS

CSV/XLSX product import (`excelParser.ts`), product export (`excelExporter.ts`), and printable B2B catalog sheets with QR codes.

---

# 22. TESTING STRATEGY & TEST SUITE COVERAGE

Vitest test suites (`src/lib/__tests__/` and `src/app/api/auth/__tests__/`) covering auth JWTs, search matching, trending calculation, and REST endpoints.

---

# 23. SECURITY CONTROL MATRIX & CRYPTOGRAPHY

CSP headers, double-submit CSRF tokens, Upstash Redis sliding-window rate limiting, bcrypt password hashing, and AES-256-GCM encryption for credentials.

---

# 24. DEPLOYMENT, PWA & SYSTEM HEALTH MONITORING

Vercel / Docker build setup, PWA service worker (`public/sw.js`), and `/api/health` monitoring probe.

---

# 25. ENVIRONMENT VARIABLES REFERENCE

`MONGODB_URI`, `JWT_SECRET`, `NEXT_PUBLIC_SITE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `UPSTASH_REDIS_REST_URL`.

---

# 26. ERROR HANDLING ARCHITECTURE

React Global Error Boundaries (`error.tsx`), structured Sentry logging (`logger.ts`), and user toast alerts (`toastStore`).

---

# 27. TROUBLESHOOTING & OPERATIONAL DIAGNOSTICS

Step-by-step procedures for MongoDB SRV timeouts, Razorpay signature mismatches, camera permissions, and HMR dev warnings.

---

# 28. KNOWN ISSUES & TECHNICAL DEBT ANALYSIS

In-memory rate limiter fallback in multi-instance environments, dynamic image allowlists, local disk upload fallbacks, and progressive type refinement.
