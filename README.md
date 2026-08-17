# FlexSell Wholesale

A multi-tier commerce platform that sells the same catalogue to **three different buyers** —
retail (B2C), wholesale (B2B), and resellers (Dropshipping) — from one product record, one
inventory pool, and one order pipeline. 

Built with Next.js 16 (App Router), React 19, TypeScript, MongoDB and Tailwind CSS v4.
Deployed on Vercel.

---

## The idea in one paragraph

The same physical product sells at three prices to three audiences. Running three storefronts
to achieve that would triple the catalogue work, so FlexSell stores **one product with a price
per tier** and resolves the right one from the signed-in customer's entitlement. A customer may
hold more than one tier, which is why entitlement is a *resolved value* rather than an account
type.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
```

### Required environment

| Variable | Purpose | If missing |
|---|---|---|
| `MONGODB_URI` | Database | Throws on connect |
| `JWT_SECRET` | Session signing | **Set this.** See the note below |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments | Payment routes return a config error |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification | Webhook returns 500 |
| `CRON_SECRET` | Scheduled job auth | Scheduled routes return 403 |
| `BLOB_READ_WRITE_TOKEN` | File storage | Falls back to local disk |
| `NEXT_PUBLIC_SITE_URL` | Absolute URLs | Defaults to localhost |

> **`JWT_SECRET` currently falls back to a value committed in this repository**
> (`src/lib/auth.ts`). Any deploy that misses the variable signs sessions with a public
> secret. Tracked as **FS-101** — fix it before the next production deploy.

### Commands

```bash
npm run dev            # development server
npm run build          # production build (also typechecks)
npm run typecheck      # tsc --noEmit
npm run test           # vitest — 261 tests
npm run lint           # eslint
npm run sync-indexes   # create MongoDB indexes (see below)
```

---

## ⚠️ Before your first deploy

Production runs with `autoIndex: false`, so **MongoDB never creates indexes on its own**:

```bash
npx tsx scripts/sync-indexes.mjs
```

Several indexes are **correctness**, not performance. The unique sparse indexes on
`WalletTransaction.paymentId` and `clientRequestId` are what stop a replayed payment webhook or
a double-submitted form from moving money twice. Without them the app still runs — it just
stops being safe.

---

## Documentation

| Document | Read it when |
|---|---|
| [Product Requirements](docs/01-Product-Requirement-Document.md) | You need to know *what* the product does and why |
| [Technical Architecture](docs/02-Technical-Architecture-Document.md) | You need to know *how* it is built |
| [Security & Access](docs/03-Security-and-Access-Document.md) | You are touching auth, permissions or money |
| [Frontend Specification](docs/04-Frontend-Specification-Document.md) | You are writing UI |
| [Feature Ticket List](docs/05-Feature-Ticket-List.md) | You are picking up work |
| [Release Report](report.md) | You need the manual test guide or the open security findings |
| [Wallet Plan](plan.md) | You are working on wallets — decision log and rationale |
| [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) | You are an AI agent working in this repo |

---

## What is in here

### Commerce

- **Catalogue** — products with nested colour → size/weight variants. Price, stock, SKU and
  barcode live at the *sub-variant* level. A+ content, HSN codes, per-tier pricing, MOQ.
- **Orders** — an append-only fulfilment stepper that shows customers one story and staff
  another, atomic stock reservation, and dispatch by self-delivery or third-party courier.
- **Invoicing** — quotes → receipts → GST tax invoices with HSN slab breakdowns.
  CGST + SGST for Madhya Pradesh, IGST elsewhere.
- **Payments** — Razorpay with server-side signature verification, Cash on Delivery, and the
  Store Wallet.
- **Dropshipping Hub** — a separate flow where the order ships to the reseller's customer.

### Wallets

Two prepaid balances per customer:

| | Store Wallet | Business Wallet |
|---|---|---|
| Buys | Products **and** services | Services only (GST filing, ads, trademark) |
| Customer spends it | Yes, at checkout | No |
| Staff spend it | Yes | Yes |
| Available to | Everyone | B2B and Dropshipping |

Every rupee creates a permanent ledger entry. Entries are never edited — corrections are
reversals that reference the original. Every staff-created entry names the person who made it,
**and the customer can see that name**.

### Operations

Multi-tier customer management with KYC, a permission-scoped manager role, CMS-driven homepage
with reorderable sections, blogs, policy pages, coupons, review moderation, an inquiry inbox
split by type, HSN registry, weight-based shipping configuration, and an analytics dashboard.

---

## Project layout

```
src/
├── app/
│   ├── (storefront)/     31 public pages
│   ├── (dashboard)/      67 pages — client, admin, manager
│   └── api/              88 route handlers
├── components/          187 components
│   ├── ui/               21 primitives — use these first
│   ├── admin/            76
│   ├── storefront/       46
│   ├── wallet/            9
│   └── …
├── lib/                  54 domain modules — guards, ledger, pricing, tax, dates
├── models/               22 Mongoose schemas
├── services/             14 client-side API wrappers
├── stores/               13 Zustand stores
└── types/                TypeScript domain types

scripts/                  sync-indexes · migrate-order-timestamps · reconcile-razorpay
docs/                     the five documents above
```

---

## Conventions that are not negotiable

These exist because each one has already caused a real bug.

| Rule | Why |
|---|---|
| **No `fetch` outside `src/services/`** | The service layer owns CSRF tokens, base URLs and error shape. Bypassing it fails silently until a token rotates |
| **All dates through `lib/datetime.ts`** | Seven routes once hand-rolled this. One order displayed three different date formats |
| **Money through `formatPrice`; wallet money in paise** | Float rupees drift. Conversion happens once, at the API edge |
| **No hardcoded colours** | The app ships a dark theme; a literal breaks it |
| **`ConfirmDialog` / `toastStore`, never `window.alert`** | Native dialogs block the tab and read as browser warnings |
| **Ledger entries are append-only** | A correction must be visible as a correction, not a rewrite |
| **Types in `src/types/`, avoid `any`** | — |

Full checklist: [Frontend Specification §13](docs/04-Frontend-Specification-Document.md).

---

## Testing

```bash
npm run test
```

261 tests. The wallet's 93 are the ones to watch — they pin the money guarantees: two
concurrent debits resolve to one, a replayed webhook credits once, a manager cannot reach an
admin route, and a customer cannot read another customer's wallet.

There is **no integration test layer**. Concurrency is unit-tested against mocks, which assume
MongoDB behaves as documented but do not prove it here. Tracked as **FS-303**.

---

## Known issues

Eight open security findings are documented in [report.md](report.md), three of them critical
and three of those fixable in one line each. Start with **FS-101, FS-102, FS-103** in the
[ticket list](docs/05-Feature-Ticket-List.md).

---

## Status

| | |
|---|---|
| Version | 2.0 — wallet release |
| Tests | 261 passing |
| Typecheck | Clean |
| Environment | Live in production |
