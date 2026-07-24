import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function getFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function countInDir(dir, extension = ".ts") {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(extension) || f.endsWith(".tsx"));
}

console.log("🔍 Scanning FlexSell Wholesale Codebase Structure...");

// Read package.json
const pkgPath = path.join(rootDir, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

// Inspect directories
const models = countInDir(path.join(rootDir, "src", "models"), ".ts").map(f => path.basename(f, ".ts"));
const services = countInDir(path.join(rootDir, "src", "services"), ".ts").map(f => path.basename(f, ".ts"));
const stores = countInDir(path.join(rootDir, "src", "stores"), ".ts").map(f => path.basename(f, ".ts"));
const apiRoutes = getFiles(path.join(rootDir, "src", "app", "api"))
  .filter(f => f.endsWith("route.ts"))
  .map(f => {
    const rel = path.relative(path.join(rootDir, "src", "app"), f);
    return "/" + path.dirname(rel).replace(/\\/g, "/");
  });

const now = new Date().toISOString();

console.log(`✅ Discovered:
  - Models (${models.length}): ${models.join(", ")}
  - Services (${services.length}): ${services.join(", ")}
  - Stores (${stores.length}): ${stores.join(", ")}
  - API Endpoint Routes (${apiRoutes.length})`);

const tick3 = "```";

// Generate Master Documentation Content
const masterDocsContent = `# FlexSell Wholesale — Master Technical Documentation Suite

> **Last Updated:** ${now}  
> **Application Version:** ${pkg.version}  
> **Framework:** Next.js ${pkg.dependencies.next || "16.2.10"} (App Router) | React ${pkg.dependencies.react || "19.2.4"} | TypeScript 5.0  
> **Database:** MongoDB Atlas (Mongoose ${pkg.dependencies.mongoose || "9.7.4"})  
> **Architecture:** Decoupled Unified Service Layer with Offline Sandbox & Live REST APIs  

---

# TABLE OF CONTENTS
1. [PRODUCT OVERVIEW & PERSONA SEGMENTS](#1-product-overview--persona-segments)
2. [TECHNOLOGY STACK INVENTORY](#2-technology-stack-inventory)
3. [SYSTEM ARCHITECTURE & DIAGRAM](#3-system-architecture--diagram)
4. [PROJECT STRUCTURE & FILE LAYOUT](#4-project-structure--file-layout)
5. [APPLICATION ROUTES SPECIFICATION](#5-application-routes-specification)
6. [DATABASE SCHEMA & ERD DIAGRAM (${models.length} MODELS)](#6-database-schema--erd-diagram-${models.length}-models)
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
17. [REST API ENDPOINT REFERENCE (${apiRoutes.length} ROUTES)](#17-rest-api-endpoint-reference-${apiRoutes.length}-routes)
18. [SERVICES & BUSINESS LOGIC LAYER (${services.length} SERVICES)](#18-services--business-logic-layer-${services.length}-services)
19. [STATE MANAGEMENT ARCHITECTURE (${stores.length} ZUSTAND STORES)](#19-state-management-architecture-${stores.length}-zustand-stores)
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
| Framework | Next.js (App Router) | ${pkg.dependencies.next || "16.2.10"} | Full-stack React framework |
| UI Engine | React / React DOM | ${pkg.dependencies.react || "19.2.4"} | Component rendering |
| Language | TypeScript | ${pkg.devDependencies.typescript || "^5"} | Type safety across stack |
| Database | MongoDB / Mongoose | ${pkg.dependencies.mongoose || "9.7.4"} | Document storage & ODM |
| State Management | Zustand | ${pkg.dependencies.zustand || "5.0.14"} | Scoped client stores |
| Payment Gateway | Razorpay SDK | ${pkg.dependencies.razorpay || "2.9.8"} | Online orders & HMAC verification |
| Logistics | Shiprocket Client | Custom | Courier serviceability & AWB labels |
| Rate Limiting | Upstash Redis | ${pkg.dependencies["@upstash/redis"] || "1.38.0"} | Sliding-window API rate limits |

---

# 3. SYSTEM ARCHITECTURE & DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 4. PROJECT STRUCTURE & FILE LAYOUT

- \`src/app/(storefront)\` — Public retail and wholesale buyer pages.
- \`src/app/(dashboard)/admin\` — Administrative management dashboard.
- \`src/app/(dashboard)/client\` — Customer account & order tracking portal.
- \`src/app/api/\` — REST API controllers (${apiRoutes.length} domain routes).
- \`src/services/\` — Unified client-side service wrappers (${services.length} services).
- \`src/stores/\` — Zustand client state stores (${stores.length} stores).
- \`src/models/\` — Mongoose schemas for MongoDB (${models.length} schemas).

---

# 5. APPLICATION ROUTES SPECIFICATION

- \`/\` — Storefront homepage featuring CMS banners, categories, trending products & new arrivals.
- \`/products\` — Catalog listing with category filters, price sorting, tag search & pagination.
- \`/products/[slug]\` — Product detail page with variant selector, B2B price tiers, A+ content & JSON-LD schema.
- \`/quote\` — B2B bulk quotation request form for negotiated wholesale orders.
- \`/checkout\` — Multi-step checkout with coupon validation, GST calculation & Razorpay payment.
- \`/client?view=orders\` — Customer order tracking timeline, invoices, receipts & profile settings.
- \`/admin\` — 18-module administrative dashboard for orders, products, CMS & analytics.
- \`/api/health\` — System health check monitoring MongoDB connection state.
- \`/documentation\` — Interactive application documentation portal.

---

# 6. DATABASE SCHEMA & ERD DIAGRAM (${models.length} MODELS)

Active Mongoose Schemas:
${models.map((m, i) => `${i + 1}. \`${m}\``).join("\n")}

## Entity Relationship Diagram (ERD)

${tick3}mermaid
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
${tick3}

---

# 7. AUTHENTICATION, LOCKOUT & AUTH FLOW DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 8. PRODUCT CATALOG & MULTI-TIER PRICING ARCHITECTURE

Products contain nested **Color Variants** and **SubVariants**:
- **SubVariant Matrix:** Size, Weight, MRP, B2C Price, B2B Price, Dropshipping Price, Stock, SKU, Barcode.
- **Price Resolution (\`priceTierHelper.ts\`):**
  - \`B2C\`: Applies \`b2cPrice\`.
  - \`B2B\`: Applies \`b2bPrice\` if set and MOQ met, fallback \`b2cPrice\`.
  - \`Dropshipping\`: Applies \`dropshippingPrice\` if set, fallback \`b2cPrice\`.

---

# 9. ATOMIC INVENTORY MANAGEMENT & AUDIT LEDGER

- Subvariant stock is atomically decremented during checkout via MongoDB \`$inc: -quantity\` queries.
- Order cancellations trigger matching \`$inc: +quantity\` restocking updates.
- All manual stock adjustments in Admin Inventory generate a \`StockLog\` audit ledger entry.

---

# 10. CART & INDIAN GST TAX ENGINE FLOW DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 11. ORDER FULFILLMENT STATE MACHINE DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 12. QUOTE ➔ RECEIPT ➔ INVOICE B2B LIFECYCLE DIAGRAM

${tick3}mermaid
flowchart TD
    Buyer([B2B Buyer Request]) --> CreateQuote[Create Draft Quote QUO-xxxx]
    CreateQuote --> AdminReview[Admin Finalizes Quote Rates]
    AdminReview --> BuyerAccept[Buyer Accepts Quote]
    BuyerAccept --> CreateOrder[Convert Quote to Active Order]
    
    CreateOrder --> CheckPayment{Payment Status?}
    
    CheckPayment -- Pending / COD --> GenReceipt[Generate Receipt RCP-xxxx]
    CheckPayment -- Paid --> GenInvoice[Generate Tax Invoice INV-xxxx]

    GenInvoice --> ImmutableRecord([Immutable GST Tax Record Preserved])
${tick3}

---

# 13. RAZORPAY PAYMENT INTEGRATION & HMAC SEQUENCE DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 14. SHIPROCKET LOGISTICS & FULFILLMENT DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 15. EVENT DISPATCHER & NOTIFICATION FLOW DIAGRAM

${tick3}mermaid
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
${tick3}

---

# 16. ADMINISTRATIVE DASHBOARD MODULES (18 MODULES)

18 modules: Overview, Products, Inventory, Orders, Invoices, Categories, Collections, Coupons, Customers, HSN, Reviews, CMS, Shipping Settings, and Theme Customizer.

---

# 17. REST API ENDPOINT REFERENCE (${apiRoutes.length} ROUTES)

Discovered Route Endpoints:
${apiRoutes.map(r => `- \`${r}\``).join("\n")}

---

# 18. SERVICES & BUSINESS LOGIC LAYER (${services.length} SERVICES)

Active Services:
${services.map(s => `- \`${s}\``).join("\n")}

---

# 19. STATE MANAGEMENT ARCHITECTURE (${stores.length} ZUSTAND STORES)

Active Zustand Stores:
${stores.map(st => `- \`${st}\``).join("\n")}

---

# 20. CONTENT MANAGEMENT SYSTEM (CMS) ARCHITECTURE

CMS Content Key-Value Store (\`CmsContent\`) managing hero banners, FAQs, trust stats, footers, blogs, testimonials, and policy documents.

---

# 21. EXCEL & BULK DATA OPERATIONS

CSV/XLSX product import (\`excelParser.ts\`), product export (\`excelExporter.ts\`), and printable B2B catalog sheets with QR codes.

---

# 22. TESTING STRATEGY & TEST SUITE COVERAGE

Vitest test suites (\`src/lib/__tests__/\` and \`src/app/api/auth/__tests__/\`) covering auth JWTs, search matching, trending calculation, and REST endpoints.

---

# 23. SECURITY CONTROL MATRIX & CRYPTOGRAPHY

CSP headers, double-submit CSRF tokens, Upstash Redis sliding-window rate limiting, bcrypt password hashing, and AES-256-GCM encryption for credentials.

---

# 24. DEPLOYMENT, PWA & SYSTEM HEALTH MONITORING

Vercel / Docker build setup, PWA service worker (\`public/sw.js\`), and \`/api/health\` monitoring probe.

---

# 25. ENVIRONMENT VARIABLES REFERENCE

\`MONGODB_URI\`, \`JWT_SECRET\`, \`NEXT_PUBLIC_SITE_URL\`, \`RAZORPAY_KEY_ID\`, \`RAZORPAY_KEY_SECRET\`, \`SHIPROCKET_EMAIL\`, \`SHIPROCKET_PASSWORD\`, \`UPSTASH_REDIS_REST_URL\`.

---

# 26. ERROR HANDLING ARCHITECTURE

React Global Error Boundaries (\`error.tsx\`), structured Sentry logging (\`logger.ts\`), and user toast alerts (\`toastStore\`).

---

# 27. TROUBLESHOOTING & OPERATIONAL DIAGNOSTICS

Step-by-step procedures for MongoDB SRV timeouts, Razorpay signature mismatches, camera permissions, and HMR dev warnings.

---

# 28. KNOWN ISSUES & TECHNICAL DEBT ANALYSIS

In-memory rate limiter fallback in multi-instance environments, dynamic image allowlists, local disk upload fallbacks, and progressive type refinement.
`;

// Write docs/FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md
const masterPath = path.join(rootDir, "docs", "FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md");
fs.writeFileSync(masterPath, masterDocsContent, "utf-8");

// Write docs/README.md
const docsReadmePath = path.join(rootDir, "docs", "README.md");
const docsReadmeContent = `# FlexSell Wholesale — Technical Documentation

Welcome to the technical documentation for **FlexSell Wholesale**, an enterprise-grade B2B, B2C, and Dropshipping e-commerce platform.

---

## 📚 Master Documentation File

The complete technical documentation, architecture diagrams, database ERD schemas, REST API endpoints, GST tax rules, and B2B workflow lifecycles are consolidated into a single master document:

👉 **[FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md](FLEXSELL_COMPLETE_TECHNICAL_DOCUMENTATION.md)**

---

## 🌐 Online Documentation Portal

View the interactive single-page documentation portal with PDF download options directly in the application:

👉 **URL:** \`/documentation\`
`;
fs.writeFileSync(docsReadmePath, docsReadmeContent, "utf-8");

console.log("🎉 Successfully updated documentation and README files!");
