# Technical Architecture Document — FlexSell Wholesale

| Field | Value |
|---|---|
| **Document version** | 2.0 |
| **Date** | 15 August 2026 |
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript 5 · MongoDB Atlas · Tailwind CSS v4 |
| **Hosting** | Vercel (serverless) |
| **Scale** | ~91,000 LOC · 98 pages · 88 API routes · 22 models · 187 components · 261 tests |

---

## Table of contents

1. [Context](#1-context)
2. [Container view](#2-container-view)
3. [Layering](#3-layering)
4. [Data architecture](#4-data-architecture)
5. [Request lifecycle](#5-request-lifecycle)
6. [Key flows](#6-key-flows)
7. [Money subsystem](#7-money-subsystem)
7A. [File storage](#7a-file-storage)
8. [Scheduled work](#8-scheduled-work)
9. [Rendering and caching](#9-rendering-and-caching)
10. [Error handling](#10-error-handling)
11. [Observability](#11-observability)
12. [Capacity and cost](#12-capacity-and-cost)
13. [Architecture decision records](#13-architecture-decision-records)
14. [Known debt](#14-known-debt)

---

## 1. Context

```
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Customer │   │ Manager  │   │  Admin   │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         └──────────────┼──────────────┘
                        ▼
         ┌──────────────────────────────┐
         │      FlexSell Wholesale      │
         └──┬────┬────┬────┬────┬───┬───┘
            │    │    │    │    │   │
     Razorpay  Blob Redis SMTP Push Sentry
     payments  files rate  mail  web  errors
                     limit
```

| System | Purpose | If it fails |
|---|---|---|
| **Razorpay** | Card/UPI/netbanking, webhooks | Gateway payments unavailable; wallet and COD still work |
| **Vercel Blob** | Product images, KYC docs, proofs | Falls back to local disk, then base64 data URI |
| **Upstash Redis** | Sliding-window rate limiting | Limiting disabled; app continues |
| **SMTP** | Transactional email | Logged and swallowed — never blocks a transaction |
| **Web Push (VAPID)** | Browser notifications | Silently skipped |
| **Sentry** | Error tracking | No user impact |

---

## 2. Container view

```
┌──────────────────────── Browser ────────────────────────┐
│  RSC pages          Client components                   │
│  13 Zustand stores  14 service modules                  │
└────────────────────────┬────────────────────────────────┘
                         │ /api/*  same-origin
┌────────────────────────▼────────────────────────────────┐
│                 proxy.ts (Edge middleware)              │
│   CSRF · JWT route guards · cache headers · CSRF cookie │
└────────────────────────┬────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
┌───▼─────────┐  ┌───────▼────────┐  ┌────────▼─────────┐
│ 88 route    │  │  54 lib/       │  │  2 cron routes   │
│ handlers    │─▶│  domain modules│  │  CRON_SECRET     │
└───┬─────────┘  └───────┬────────┘  └────────┬─────────┘
    └────────────────────┼────────────────────┘
                         │ Mongoose
              ┌──────────▼───────────┐
              │   MongoDB Atlas      │
              │   22 collections     │
              └──────────────────────┘
```

**Everything runs in one Next.js deployment.** No separate API service: the same repository
serves pages and endpoints, so a type change to a domain object is a compile error at both ends
rather than a runtime surprise.

---

## 3. Layering

Dependencies point inward. Nothing in an inner layer imports from an outer one.

| Layer | Directory | May import | Must never |
|---|---|---|---|
| **Presentation** | `app/**/page.tsx`, `components/**` | services, stores, types | `fetch`, models, `lib/db*` |
| **Client state** | `stores/**` (13) | services, types | models |
| **Service** | `services/**` (14) | `apiClient`, types | models |
| **Route handler** | `app/api/**` (88) | lib, models, types | components |
| **Domain** | `lib/**` (54) | models, types | HTTP objects |
| **Data** | `models/**` (22) | types | anything above |

### Why the service layer is mandatory

`apiClient` owns four things a direct `fetch` silently loses: CSRF token attachment,
server-versus-browser base URL resolution, a single error shape (`ApiError`), and the mock-mode
fallback. The failure mode is not a crash — it is a request that works today and 403s the day a
token rotates.

---

## 4. Data architecture

### 4.1 Collections

| Domain | Collections |
|---|---|
| Catalogue | `Product`, `Category`, `Collection`, `HsnRecord` |
| Commerce | `Order`, `Invoice`, `Coupon`, `ShippingConfig`, `StockLog` |
| Identity | `Customer`, `Manager`, `OtpVerification` |
| Money | `Wallet`, `WalletTransaction`, `WalletExpenseCategory` |
| Engagement | `Review`, `Inquiry`, `Newsletter`, `Notification`, `NotificationPreference`, `PushSubscription` |
| Content | `CmsContent` |

### 4.2 String primary keys

Every domain document uses a human-readable `_id` (`FS-10042`, `CUST-1042`, `INV-9001`) minted
by `idGeneratorServer` from an atomic counter — not an ObjectId.

**Why:** these ids appear on invoices, in support conversations and in URLs. An ObjectId is
unreadable over the phone.

**Cost:** Mongoose's `FilterQuery` generic expects ObjectId, so a few filters are cast to
`Record<string, unknown>` with a comment explaining why.

### 4.3 Nested variants

```
Product
└── colorVariants[]          colour, dimensions, images
    └── subVariants[]        size, weight, MRP, 3 tier prices, MOQ, stock, SKU, barcode
```

Stock reaches the correct leaf atomically with `arrayFilters`:

```js
Product.updateOne(
  { _id, "colorVariants.color": colour },
  { $inc: { "colorVariants.$[cv].subVariants.$[sv].stock": -qty, totalStock: -qty } },
  { arrayFilters: [{ "cv.color": colour }, { "sv.size": size, "sv.weight": weight }] }
)
```

### 4.4 Deliberate denormalisation

`Order.createdBy` and `WalletTransaction.createdBy` store `{ userId, name, role }` **inline**.

> A manager who later leaves and is deleted would otherwise turn every one of their past
> entries into "Unknown", and a rename would silently rewrite history. The ledger is
> append-only; the actor is part of the entry, not a lookup performed when it is read.

Order line items snapshot the product at purchase time for the same reason — an invoice must
show what was bought, not what the catalogue says today.

### 4.5 Indexing

Production sets `autoIndex: false`. Without it, every serverless cold start re-issued
`createIndex` for all 22 models.

**Consequence:** indexes are never created automatically. Run `npm run sync-indexes` after any
schema change. The script auto-discovers `src/models/*.ts` — no registration step.

Indexes that are **correctness**, not performance:

| Index | Guarantees |
|---|---|
| `WalletTransaction.paymentId` unique sparse | A replayed webhook credits once |
| `WalletTransaction.clientRequestId` unique sparse | A double-submitted form debits once |
| `WalletTransaction.receiptNumber` unique | No two entries share a receipt |
| `Wallet {userId, type}` unique | One wallet of each type per customer |
| `Order.quoteId` unique sparse | One quote converts to one order |
| `Customer.email` unique | One account per address |

Both wallet idempotency indexes are **sparse** because most entries have neither field. A
non-sparse unique index would reject the second document with a null value — breaking the
feature the moment it launched.

---

## 5. Request lifecycle

### 5.1 Middleware (`src/proxy.ts`)

1. **CSRF** — double-submit cookie on POST/PUT/PATCH/DELETE, compared timing-safely.
   PATCH is included deliberately; omitting it once left every PATCH route reachable
   cross-site with no token.
2. **Route guards** — `/admin`, `/manager`, `/client` verified with `jose`
   (Edge-compatible; `jsonwebtoken` is Node-only).
3. **Cache headers** — public read-only GETs may be edge-cached; everything else `no-store`.
4. **CSRF cookie** issued when absent.

### 5.2 Authorisation guards

| Guard | Admits | Permission source |
|---|---|---|
| `requireAuth(role?)` | Any session, optionally role-pinned | JWT |
| `requireAdminOrManagerAuth(p)` | Admin, or manager holding `p` | **Database** |
| `verifyManagerOrderAccess` | By order type | Database |
| `requireWalletSpendAccess(t)` | Admin, or manager with exactly `wallet_<t>` | **Database** |
| `requireWalletAdmin()` | Admin only | JWT role |
| `requireWalletRead(target?)` | Owner, or any staff | JWT role |

Guards returning `{ payload, error }` rather than throwing keeps route bodies flat:

```ts
const auth = await requireWalletAdmin();
if (auth.error) return auth.error;
```

---

## 6. Key flows

### 6.1 Checkout by gateway

```
Browser              Server                 Razorpay        MongoDB
  │  place order       │                       │              │
  ├───────────────────▶│  reserve stock ───────┼─────────────▶│
  │◀── orderId ────────┤                       │              │
  │  start payment     │                       │              │
  ├───────────────────▶│  mint order (₹ from   │              │
  │                    │   the stored order) ─▶│              │
  │◀── handle ─────────┤                       │              │
  ├──────── pay ──────────────────────────────▶│              │
  │◀─ callback ────────┼◀──── webhook ─────────┤              │
  │                    │  settle (idempotent) ─┼─────────────▶│
  │                    │                       │              │
  │        whichever arrives first wins; the other is a no-op
```

If the buyer abandons, the order is released immediately; the daily reaper is the backstop for
a closed tab.

### 6.2 Checkout by wallet

```
Browser                Server                        MongoDB
  │  place order         │                              │
  ├─────────────────────▶│  reserve stock ─────────────▶│
  │◀── orderId ──────────┤                              │
  │  pay from wallet     │                              │
  ├─────────────────────▶│  reserve funds ─────────────▶│  available → held
  │                      │  capture ───────────────────▶│  held → debited
  │                      │  mark order paid ───────────▶│
  │◀── balance ──────────┤                              │
  │                      │                              │
  │      any failure after reserve releases the hold
```

### 6.3 Order fulfilment

```
Placed ──▶ Processing ──▶ Shipped ──▶ Delivered
   │            │            │            │
   └── Cancel ──┘            │        (locked)
        restores stock       └── edit appends, never rewinds
        refunds wallet
```

Every transition appends a history event carrying **two texts** — a customer-safe note that
never names staff, and an internal note that always does.

### 6.4 Upgrade to wholesale

```
Customer requests B2B/Dropshipping
        │
        ▼
Uploads KYC (GST cert, PAN, Aadhaar, cheque, signature, photo)
        │
        ▼
Admin reviews ──── validateCustomerKycRequirements()
        │                 │
     approve           missing → blocked, names what is absent
        │
        ▼
customerTypes updated → entitlement resolves to the new tier immediately
```

---

## 7. Money subsystem

The most safety-critical area. Five properties hold it together.

### 7.1 One writer

`lib/walletLedger.ts` is the only module that may change a balance. If a balance and its ledger
ever disagree, exactly one place could have caused it.

### 7.2 Conditional atomic updates

```js
Wallet.findOneAndUpdate(
  { _id, status: "active", availableBalance: { $gte: amountPaise } },
  { $inc: { availableBalance: -amountPaise, totalDebited: amountPaise } },
  { new: true, session }
)
```

The check and the decrement are one operation. Two concurrent ₹800 debits against ₹1,000
resolve to exactly one success. Read-then-write would let both read 1,000, both pass, and the
wallet go negative.

### 7.3 Two-sided idempotency

| Direction | Key | Minted by |
|---|---|---|
| Credit | `paymentId` | Razorpay |
| Debit | `clientRequestId` | The form, when it **opens** |

A client key rather than a content hash: two genuinely separate ₹6,000 ad spends on the same
day are legitimate and must not collide. Intent is what must be unique, and only the client
knows where one intent ends and the next begins.

### 7.4 Reserve, then capture

```
available ──reserve──▶ held ──capture──▶ debited
                        └────release────▶ available
```

Both transitions are conditional on the hold still being `pending`, so a capture racing the
sweeper resolves to exactly one outcome — never both taken and returned.

### 7.5 Reconciliation reports, never repairs

Nightly, per wallet: `sum(credits) − sum(debits)` must equal `availableBalance + heldBalance`.
Drift raises an alert and changes nothing — an automatic correction would hide the bug that
caused it, and the ledger is the record of truth.

Held balance is included because it has left `availableBalance` without being debited; omitting
it would make every wallet with a live checkout look permanently short.

---

## 7A. File storage

Files are the second place this system spends real money, and it went wrong the same way money
subsystems do — by having two implementations that disagreed.

### 7A.1 One writer

`lib/storage/` is the only module that writes a file, mirroring §7.1's rule for balances.
Before it there were two upload routes with different fallbacks, limits and return shapes, and
eight components calling `fetch` directly — so a defect in one of them had eight places it
could have been introduced and only one place it could be fixed.

```
uploadFile({ buffer, filename, contentType, kind })
   ├── vercelBlob      primary
   ├── cloudinary      fallback #1
   └── supabaseStorage fallback #2
```

Providers are tried in order; the first **configured** one that succeeds wins.

### 7A.2 Two asset classes

| Class | Examples | `access` | Stored in Mongo | Cache |
|---|---|---|---|---|
| **Public** | product, category, collection and CMS imagery | `public` | the **CDN URL** | `max-age=31536000`, immutable |
| **Private** | `kycDocuments.*`, `walletTransaction.proofUrl`, dropship documents, shipping labels | `private` | the **pathname** | `no-store` |

A private reference is a pathname, never a URL: a URL is either permanently public or it
expires, and a stored reference must be neither. Reads go through
`GET /api/documents/[...pathname]` — authenticated, ownership-checked, and answering with a
**302 to a short-lived signed URL** so the bytes travel from the CDN to the browser without
passing through a function.

### 7A.3 Why the URL in the database matters

Uploads used to store `/api/customers/document/<name>?url=<blobUrl>`. Every view was therefore
served by a serverless function that fetched the blob and re-streamed it:

```
browser → function → blob   (egress #1)
browser ← function ← bytes  (egress #2)   …with no Cache-Control at all
```

Two billed egresses per view, the CDN bypassed entirely, and the whole file buffered in
function memory by `arrayBuffer()`. **255 MB of stored files produced 10 GB of transfer** —
roughly 40× amplification — which exhausted the plan's quota and suspended the store.

Storing the direct reference is the fix. `scripts/migrate-document-urls.mjs` rewrites the
historic rows; the legacy route is retained read-only (now authenticated) until it has run
everywhere.

### 7A.4 Degradation, not failure

Provider availability is decided by typed SDK errors, never by matching message text:

| Error | Treated as |
|---|---|
| `BlobStoreSuspendedError`, `BlobServiceRateLimited`, `BlobServiceNotAvailable` | `PROVIDER_UNAVAILABLE` → try the next provider |
| `BlobStoreNotFoundError`, `BlobAccessError` | `PROVIDER_MISCONFIGURED` → try the next, alert |
| anything else | `UPLOAD_FAILED` → **stop** |

The last row is the important one: a file the first provider *refused* must not be retried
elsewhere, or a rejected content type gets stored by whichever provider happens to be laxer.

### 7A.5 Compression and deletion

Images are compressed in the browser before upload (`lib/uploadHelper.ts`, max 1 MB / 1920 px)
— the cheapest byte is the one never stored, and no amount of caching beats not storing it.

`deleteFile()` exists because `put` without `del` is a leak: the codebase previously imported
`put` and never `del`, so every replaced document stayed in the store forever.
`scripts/sweep-orphan-blobs.mjs` reports unreferenced objects and is **report-only by
default** — blob deletion is the one irreversible step in this design.

---

## 8. Scheduled work

Vercel Hobby allows **two cron jobs, each once per day**. Both slots are used.

| Path | Schedule | Work |
|---|---|---|
| `/api/orders/reap-abandoned` | `0 0 * * *` | Cancel unpaid online orders, return stock |
| `/api/wallet/maintenance` | `30 20 * * *` (02:00 IST) | Stuck top-ups + expired holds + reconciliation, one pass |

**Daily is too slow to be a customer's only route to their own money.** So stuck top-ups also
settle **lazily on read**: opening the wallet checks that customer's own pending payments,
gated behind an indexed count so the common case costs one query and never touches Razorpay.
The person waiting triggers the work; the cron catches customers who never return.

This is cheaper than a frequent cron on any plan — a half-hourly schedule bills 48 invocations
a day whether or not a payment is stuck.

---

## 9. Rendering and caching

| Content | Strategy | Rationale |
|---|---|---|
| Product / category / collection | ISR + `generateStaticParams` | SEO and speed |
| Storefront listings | ISR, revalidated on write | Mostly static |
| Cart, checkout | Client | Per-session |
| Dashboards | Client against `no-store` | Never cacheable |
| **All wallet routes** | `force-dynamic` + `no-store` | One customer seeing another's balance is the worst possible bug |

`images.unoptimized: true` is a deliberate current state: `remotePatterns` still contains a
wildcard, and enabling optimisation before narrowing it would let arbitrary hosts through the
image proxy. The reversal steps are documented in `next.config.ts`.

---

## 10. Error handling

| Layer | Strategy |
|---|---|
| Route handlers | Try/catch returning a typed JSON message; never leak a stack trace |
| Domain | Typed errors carrying a status (`InsufficientBalanceError` → 409) |
| Services | Throw `ApiError` with status and body |
| Components | Distinct empty / loading / error / zero states |

### Status conventions

| Code | Means |
|---|---|
| 400 | Malformed or incomplete request |
| 401 | Not signed in, or a failed step-up |
| 403 | Signed in, not permitted |
| 404 | Not found, or not visible to this caller |
| 409 | Valid request, impossible state — insufficient balance, already reversed, order locked |
| 423 | Locked out after repeated failures |
| 429 | Rate limited |

**409 is used deliberately** where a naive design would use 500. An insufficient balance is a
business outcome the caller should show, not a fault to log.

### Failures that must never cascade

| Failure | Behaviour |
|---|---|
| Email send | Logged, swallowed — never rolls back a committed transaction |
| Push notification | Same |
| Webhook dispatch | Fire-and-forget with a caught rejection |
| Lazy sweep on wallet read | Caught; the page renders with a possibly stale balance rather than an error |
| Sitemap generation | Falls back to static routes |

The rule: **nothing that happens after a commit may undo it.**

---

## 11. Observability

| Signal | Where |
|---|---|
| Exceptions | Sentry (client and server configs) |
| Analytics | Vercel Analytics |
| Money events | `console.warn` / `console.error` with a `[Wallet]` prefix |
| Drift | `[Wallet Reconciliation] DRIFT DETECTED` + a `SECURITY_ALERT` event to admins |
| Staff spend | Daily digest by category and by manager |
| Offline credits | `/api/wallet/offline-register` — proof links, admin name, IP |
| Health | `/api/health` |
| Diagnostics | `/api/system-diagnostics` — admin-only, secrets masked |

Log levels carry meaning: `console.warn` and `console.error` are reserved for events needing
attention, so a filtered production log is actionable rather than noisy.

---

## 12. Capacity and cost

### 12.1 Constraints

| Resource | Limit | Consequence |
|---|---|---|
| Vercel cron | 2 jobs, once daily | Wallet maintenance is one combined pass; sweeps run lazily |
| Serverless timeout | 60s (`maxDuration` on uploads) | Bulk operations are chunked |
| Mongo pool | `maxPoolSize: 10`, cached globally | Survives serverless reuse |
| ISR writes | Billed per revalidation | Revalidation is targeted, not blanket |

### 12.2 Cost decisions

| Decision | Saves |
|---|---|
| Lazy sweep instead of a frequent cron | ~48 invocations/day |
| Field projection on list queries | Payload and function time |
| Server-side aggregation | Function time, and scales with data |
| ISR for the catalogue | Function invocations per view |
| `unoptimized` images | Image transformation quota (traded for bandwidth) |

---

## 13. Architecture decision records

### ADR-001 — One Next.js app, no separate API

**Decided.** A single deployment serving pages and endpoints.
**Because** a shared type layer turns contract drift into a compile error, and a team this size
does not benefit from independent deployability.
**Cost:** page and API traffic scale together.

### ADR-002 — String `_id` instead of ObjectId

**Decided.** Human-readable ids from atomic counters.
**Because** they appear on invoices and in support calls.
**Cost:** occasional casts around Mongoose's generics.

### ADR-003 — Wallet money in paise, the rest in rupees

**Decided.** Integer paise inside the wallet only; conversion at the API edge.
**Because** `0.1 + 0.2 !== 0.3`, and a wallet that drifts a paisa per transaction is
unauditable.
**Rejected:** converting the whole app — too large a migration on live data.
**Cost:** one boundary to police, mitigated by naming every paise variable with the suffix.

### ADR-004 — One wallet model with a type discriminator

**Decided.** `Wallet { type: "store" | "business" }`.
**Because** atomic updates, the append-only ledger, receipt numbering, idempotency, passbook,
freeze/close and reconciliation are **identical** for both. Two models means every one of those
bugs gets fixed twice, and the second fix gets forgotten.
**Cost:** route-level branching for who may spend.

### ADR-005 — Extend the payment webhook rather than add one

**Decided.** Wallet top-ups settle in a branch of the existing Razorpay webhook.
**Because** that route already verifies the signature over the raw body and is already
CSRF-exempt. A second endpoint means rebuilding both, and getting either wrong on a route that
credits money is not recoverable.
**Cost:** one route serves two domains.

### ADR-006 — Detection instead of prevention for staff spend

**Decided.** No spend caps, no customer approval, no per-customer scoping.
**Because** the business requires staff to act without waiting.
**Consequence:** any manager with a wallet permission can spend any amount from any customer's
wallet immediately. Six detective controls make it impossible to do *quietly* — attribution, a
mandatory bill, a non-suppressible customer email, an immutable audit trail, a daily digest,
and a query action on every row.
**Reversible:** `awaiting_approval` already exists in the status enum, so adding caps later is a
route change, not a migration.

### ADR-007 — Lazy sweep plus a daily cron

**Decided.** Stuck top-ups settle when the customer opens their wallet, with a nightly backstop.
**Because** the hosting plan allows two daily jobs, and a day is too long to wait for money
already paid.
**Also cheaper** than a frequent cron on any plan.

### ADR-008 — Reconciliation alerts, never auto-corrects

**Decided.** Drift is reported and left alone.
**Because** an automatic fix hides the defect that caused it, and the ledger — not the balance
field — is the record of truth.

### ADR-009 — Append-only fulfilment history

**Decided.** Amendments add entries; nothing is rewritten and no status is rewound.
**Because** an edit that rewinds a Delivered order to Shipped destroys the record of what
actually happened. Delivery additionally **locks** fulfilment, enforced server-side.

### ADR-010 — Mock mode is read-only for wallets

**Decided.** Wallet reads may return fixtures; every wallet write throws under `isMockMode`.
**Because** a mocked top-up that reports success teaches the interface that money moved when
nothing did, and the same code path in the wrong environment is a phantom balance.
**Departs** from every other service deliberately: those move data, this moves money.

---

## 14. Known debt

| # | Debt | Impact | Fix | Ticket |
|---|---|---|---|---|
| 1 | Admin and manager pages duplicated | Two missed updates in one release | Shared component with `basePath` / `isAdmin` | FS-301 |
| 2 | Admins are `Customer` documents | Three `$ne: "admin"` filters as a fail-open workaround | Separate collection, preserve `_id` | FS-302 |
| 3 | Permissions in a 1-day JWT | Revocation delayed on three handlers | Always re-read from the database | FS-107 |
| 4 | No integration tests | Concurrency proven against mocks only | Test database with a replica set | FS-303 |
| 5 | `JWT_SECRET` falls back to a committed value | Forgeable admin tokens if the variable is missed | Throw at module load | FS-101 |
| 6 | `images.remotePatterns` wildcard | Blocks enabling image optimisation | Enumerate real hosts | FS-506 |
