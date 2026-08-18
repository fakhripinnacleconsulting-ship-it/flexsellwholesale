# Feature Ticket List — FlexSell Wholesale

| Field | Value |
|---|---|
| **Document version** | 2.0 |
| **Date** | 15 August 2026 |
| **Backlog owner** | FlexSell Wholesale |
| **Total** | 42 tickets across 6 epics |

**Sizing:** XS < 1h · S ≤ ½ day · M 1–3 days · L ≥ 1 week
**Priority:** P0 stop-everything · P1 this sprint · P2 next · P3 when there is room

Every ticket carries: context, the change, and acceptance criteria that can be verified.

---

## Epic index

| Epic | Tickets | Theme |
|---|---|---|
| [E1 — Security remediation](#e1--security-remediation) | 8 | Close the audit findings |
| [E2 — Complete the wallet](#e2--complete-the-wallet) | 7 | Finish what W-1…W-16 started |
| [E3 — Structural debt](#e3--structural-debt) | 5 | Stop repeat-cause bugs |
| [E4 — Catalogue and commerce](#e4--catalogue-and-commerce) | 7 | Core product gaps |
| [E5 — Operations](#e5--operations) | 8 | Staff tooling |
| [E6 — Quality and polish](#e6--quality-and-polish) | 7 | UI, performance, testing |

---

## Shipped — August 2026

Landed since this list was written. Kept here because several tickets below assume the old
behaviour.

| Area | What changed | Reference |
|---|---|---|
| **Receipt → invoice** | Settlement moved to `POST /api/invoices/[id]/settle` — the only route that may mark a document paid or mint an `INV-` number. A paid receipt now issues a **separate** invoice document instead of having its `type` flipped in place, which had left every tax invoice carrying its `REC-` number (GST Rule 46(b)) | [settle route](src/app/api/invoices/[id]/settle/route.ts) |
| **Wallet settlement** | A wallet payment now reserves → captures through the ledger. A short balance returns **409** and nothing changes; previously the UI dropdown was decorative and a ₹0 wallet settled in full | same |
| **Wallet authorisation** | `admin-pay-order` uses `requireWalletSpendAccess`; a bare role check had let any manager spend any customer's balance | [admin-pay-order](src/app/api/wallet/admin-pay-order/route.ts) |
| **File storage** | One provider-agnostic layer, two asset classes, client-side compression, direct URLs in the database, deletion, orphan sweep | ADR §7A |
| **Document proxy** | Authenticated, ownership-checked, `?url=` ignored (SEC-09) | [legacy route](src/app/api/customers/document/[filename]/route.ts) |
| **Statement period** | `formatRangePeriod()` — a downloaded statement states its own dates instead of "This month" | [dateRange.ts](src/lib/dateRange.ts) |
| **Spend breakdown** | Store → Business transfers now appear in "Where your money went". ⚠️ **Total Spent rises** for wallets with transfers — announce it | [breakdown route](src/app/api/wallet/breakdown/route.ts) |
| **MOQ** | Applies to verified B2B only, decided in one helper (`enforceMoq`). Three cart clamp sites had disagreed; two ignored the customer's type entirely | [priceTierHelper.ts](src/lib/priceTierHelper.ts) |
| **Order categorisation** | `orderType` is the authority. The customer dashboard had inferred it from price tiers and claimed *any non-B2B COD order* as Dropshipping | [ClientOrdersView.tsx](src/components/storefront/ClientOrdersView.tsx) |
| **Timestamps** | Documents render `issuedAt`, not `new Date(generatedAt)` — a date-only string that parsed to midnight, so every manager document row read 12:00 AM. `formatDateTimeIST` now warns in development when handed one | [datetime.ts](src/lib/datetime.ts) |
| **Type checking** | `ignoreBuildErrors` removed; nine real errors fixed | [next.config.ts](next.config.ts) |

**Migrations written, not yet run in production** — see the runbook in the repository root.

---

# E1 — Security remediation

> **Four of these are one-line changes.** Ship FS-101, 102, 103 and 104 together, before
> anything else in this backlog.

### FS-101 · Remove the `JWT_SECRET` fallback
**P0 · XS · Backend**

`src/lib/auth.ts:5` falls back to `"default-flexsell-secret-key-change-in-production"` — a
string published in this repository. Any deploy that misses the variable signs every session
with a secret an attacker can read, and admin tokens become forgeable. `src/proxy.ts` already
reads it with no fallback and fails closed; the two files disagree, and the dangerous one is
the default.

```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is not set");
```

**Acceptance**
- The app refuses to start without the variable
- Sign-in works with it set
- No literal secret remains in the repository

---

### FS-102 · Sanitise collection descriptions
**P0 · XS · Frontend**

`(storefront)/collections/[slug]/page.tsx:141` renders `collection.description` through
`dangerouslySetInnerHTML` **unsanitised**. The blog page one directory away does it correctly.
Anyone with CMS access can store a payload that executes for every visitor — including an
admin, whose session it then acts with.

**Acceptance**
- Description passes through `sanitizeHtml()`
- A stored `<img src=x onerror=alert(1)>` renders inert
- Legitimate formatting still renders

---

### FS-103 · Bind `TEST_MODE` to non-production
**P0 · XS · Backend**

`TEST_MODE=true` disables **CSRF** (`proxy.ts:42`) and **rate limiting** (`rateLimit.ts:37`)
across every route, with no environment guard.

```ts
const isTestMode = process.env.TEST_MODE === "true" && process.env.NODE_ENV !== "production";
```

**Acceptance**
- With `NODE_ENV=production`, both controls stay active regardless of `TEST_MODE`
- Tests still pass
- The variable is confirmed absent from Vercel production

---

### FS-104 · Authenticate notification preferences
**P0 · S · Backend**

`/api/notifications/preferences` has no authentication and takes `userId` from the query string
and body. Anyone can read or overwrite anyone's preferences.

Worse than it looks: silencing a target's `security` and `payments` notifications is a
**preparatory step** — the wallet's entire detective-control design assumes those emails arrive.

**Acceptance**
- Unauthenticated request → 401
- `userId` comes from the session, never the request
- Customer A cannot read or write customer B's preferences
- Staff reading another user's preferences pass an explicit staff check

---

### FS-105 · Authenticate the document upload endpoint
**P1 · S · Backend**

`/api/customers/upload-document` has **no auth** and is CSRF-exempt. The MIME check is not a
control — `file.type` is supplied by the client, not sniffed. Now also used for wallet payment
proofs and expense bills.

**Acceptance**
- Anonymous upload → 401
- Removed from the CSRF exemption list
- File type determined from magic bytes; a `.html` declared as `image/png` is rejected
- Rate limit retained

---

### FS-106 · Make KYC documents private
**P1 · M · Backend**

**The most serious open finding.** Aadhaar, PAN, cancelled cheques, GST certificates and wallet
proofs are all stored with `access: "public"`. Anyone holding the URL retrieves them with no
session, and `kyc-${Date.now()}-${originalName}` is millisecond-precision — enumerable, with
guessable filenames.

**Acceptance**
- New uploads use `access: "private"`
- Documents served through a route authorising owner-or-staff
- Filenames use a random UUID
- Existing blobs migrated or re-uploaded and the old URLs invalidated
- The customer and staff can still view documents in the UI

---

### FS-107 · Read manager permissions from the database
**P1 · S · Backend**

`api/customers/route.ts` lines **169, 270 and 371** — GET, PUT and DELETE — read
`payload.permissions` from the JWT. The token lives a day, so a suspended manager can still
read, edit **and delete** customers until it expires. `requireAdminOrManagerAuth` already does
this correctly two imports away.

**Acceptance**
- All three use `requireAdminOrManagerAuth`
- Suspending a manager blocks `DELETE /api/customers` immediately, without a logout
- Existing permission behaviour unchanged for active managers

---

### FS-108 · Make the sanitiser fail closed
**P2 · XS · Backend**

`lib/sanitize.ts:17-21` — if DOMPurify throws, the regex fallback only matches quoted handlers.
`<img src=x onerror=alert(1)>` survives.

**Acceptance**
- The fallback returns escaped text or an empty string, never partially stripped HTML
- Half-cleaned HTML is never rendered

---

# E2 — Complete the wallet

### FS-201 · Offline credit register screen
**P1 · M · Frontend**

`/api/wallet/offline-register` returns the data; nothing renders it. This is the report that
makes cash credits reviewable **together** — credits visible only inside individual wallets
will never be reviewed as a set, and a pattern across customers is exactly what one wallet
cannot show.

**Acceptance**
- A page at `/admin/wallets/offline-register`
- Date range (reuse `DateRangePicker`) and filter by admin
- Totals per admin per source
- Table: date, customer, wallet, source, amount, reference, proof link, recorded by, IP
- CSV export
- Admin-only; a manager receives 403

---

### FS-202 · Expense category management screen
**P1 · S · Frontend**

The API supports add, rename and deactivate; there is no UI.

**Acceptance**
- A section under `/admin/settings`
- List with colour swatches; add, rename, change colour, activate/deactivate
- **No delete** — deactivating preserves historic rows
- A new category appears in the expense form immediately
- A deactivated category disappears from the picker but still labels past entries

---

### FS-203 · Open a receipt from the passbook
**P1 · S · Frontend**

`WalletReceiptDocument` renders correctly but nothing opens it.

**Acceptance**
- A receipt action on every passbook row
- Opens a print modal via `triggerPrintWithTitle`, as the invoice does
- Available to the customer and to staff
- Print styles drop navigation

---

### FS-204 · Replace native dialogs in the wallet
**P1 · S · Frontend**

`StaffWalletPanel` uses `window.prompt` for the transfer amount, the admin password and the
freeze reason. Two consecutive native prompts for an **irreversible** transfer is poor.

**Acceptance**
- Transfer and freeze use proper dialogs matching `AddFundsOfflineDialog`
- The password field is inline in the same dialog, never a second prompt
- No native dialog remains in `src/components/wallet/`

---

### FS-205 · Passbook PDF export
**P2 · S · Frontend**

CSV ships; PDF is what a customer files.

**Acceptance**
- Reuses `pdfPrintHelper` — no new library
- Print styles drop the donut and navigation
- Header repeats customer, wallet and range on every page
- Footer carries page numbers and the non-refundable notice

---

### FS-206 · Razorpay refund API
**P2 · M · Backend**

`lib/razorpayPayment.ts:97` only logs "refund manually". Admin closure decisions and genuine
error corrections have no way to return money to source — the one path that moves money outside
the ledger.

**Acceptance**
- Refund call implemented against Razorpay
- A `REFUND` ledger entry references the original
- Idempotent on the Razorpay refund id
- Available only to admins, with password re-verification

---

### FS-207 · Monthly statement email
**P3 · M · Backend**

Blocked on cron capacity — Vercel Hobby allows two daily jobs and both are used.

**Options:** fold a monthly check into the existing maintenance job (cheapest), or upgrade.

**Acceptance**
- Sent on the 1st with the previous month's statement attached
- Respects the customer's notification preferences
- Does not require a third cron slot

---

# E3 — Structural debt

### FS-301 · De-duplicate admin and manager pages
**P1 · M · Frontend**

`customers/[id]`, `inquiries` and `orders` exist twice. `customers/[id]` is ~400 lines
duplicated almost word for word.

Not theoretical: during the wallet release the panel was added to the admin copy and **did not
appear for managers**; the same happened again with the KYC visibility change. Two misses in
one release.

**Acceptance**
- One component per screen, taking `basePath` and `isAdmin`
- Both routes become thin wrappers
- Manager retains `PermissionGuard`
- A change made once appears in both

---

### FS-302 · Separate admins from the customer collection
**P2 · L · Backend**

Admins are `Customer` documents with `role: "admin"`. Three queries carry
`role: { $ne: "admin" }` as a **fail-open** workaround. Admins also carry `customerTypes`,
which technically makes them wallet-eligible.

Migration is safe: `createdBy` on orders, invoices and wallet transactions is **denormalised**,
not a reference, so moving the document breaks no history **provided `_id` is preserved**.

**Acceptance**
- `Admin` model; documents migrated with the same `_id`
- `getActiveCustomerServer` branches by role, as `getActiveManagerServer` already does
- Login looks in both collections
- The three `$ne` filters are deleted
- Historic attribution still resolves
- **Shipped as its own change, never bundled with a feature**

---

### FS-303 · Integration test layer
**P2 · L · Backend**

Concurrency guarantees are unit-tested against mocks. The mocks assume MongoDB behaves as
documented; nothing proves it does here.

**Acceptance**
- Test database with a replica set
- Two simultaneous debits → exactly one succeeds
- A replayed webhook → credited once
- A capture racing the sweeper → exactly one outcome
- A transfer writes both entries or neither
- Runs in CI

---

### FS-304 · Route smoke tests
**P2 · S · Backend**

BUG-01 — the customer wallet returning 403 to its own owner — happened because
`requireWalletRead` compared `payload.userId` against an empty string. It was the one guard
with no coverage.

Regression tests now exist, but **no test asserts a route's happy path end to end**. A guard
can be correct in isolation and still be called wrongly.

**Acceptance**
- A smoke test per wallet route: signed-in customer, no query parameters, expect 200
- Extended to order and invoice routes
- Runs in CI

---

### FS-305 · Define a data retention policy
**P3 · M · Backend**

Nothing is purged. OTP records, login history and stock logs accumulate indefinitely.

**Acceptance**
- Retention agreed per collection (see Security §7.3)
- TTL indexes on OTP records
- Bounded arrays for login history
- Wallet ledger explicitly **exempt** — it is a financial record

---

# E4 — Catalogue and commerce

### FS-401 · Wallet + gateway split payment
**P2 · M · Full-stack**

Today the wallet must cover the whole order. A customer ₹500 short cannot use their ₹4,500.

**Acceptance**
- Checkout offers "pay ₹4,500 from wallet, ₹500 by card"
- Wallet portion reserved before the gateway is invoked
- Both capture or neither
- **If Razorpay fails after the hold, the hold is released**
- `Order.paymentMethod` uses the existing `"Wallet+Razorpay"` value

---

### FS-402 · Customer approval for expenses
**P2 · M · Full-stack**

Declined for v1 in favour of speed. The plumbing exists — `awaiting_approval` is already in the
status enum.

**Acceptance**
- Staff raise a consent instead of spending directly
- The customer sees it on the wallet page and approves or declines
- Spend fires on approval only
- A **hybrid** is preferred: standing authorisation up to a ceiling, explicit approval above it

---

### FS-403 · Manager spend caps
**P2 · S · Backend**

The cheapest single narrowing of the current exposure — a route change, not a redesign.

**Acceptance**
- Per-transaction and daily caps, configurable per manager
- Above the cap → `awaiting_approval`, not rejection
- Admin approval queue
- Existing behaviour unchanged when no cap is set

---

### FS-404 · Per-customer manager scoping
**P3 · L · Full-stack**

`wallet_business` is an all-customers permission because no `assignedCustomers` relationship
exists. Adding one is useful well beyond wallets.

**Acceptance**
- `assignedCustomers[]` on `Manager`
- Guards honour it when populated; unchanged when empty
- Permission UI shows the real scope

---

### FS-405 · Multi-warehouse inventory
**P3 · L · Full-stack**

Stock is a single pool. Multiple locations need stock per warehouse and location-aware shipping.

---

### FS-406 · Bulk price update by category or tier
**P2 · M · Full-stack**

Price changes are per sub-variant. A 5% B2B increase across a category is currently manual.

**Acceptance**
- Select by category, collection or tag
- Percentage or fixed adjustment, per tier
- Preview before applying
- Every change logged with the actor

---

### FS-407 · Abandoned cart recovery
**P3 · M · Full-stack**

Carts are client-side only; an abandoned cart leaves no trace.

**Acceptance**
- Carts persisted for signed-in customers
- Reminder email after 24 hours, respecting preferences
- Recovery link restores the cart

---

# E5 — Operations

### FS-501 · Replace `alert()` in order creation
**P2 · S · Frontend**

`ConfirmOrderStep.tsx` uses `alert()` nine times for field validation. Native dialogs block the
tab and read as browser warnings; inline errors are the convention and the styling exists.

**Acceptance**
- Every validation error appears inline beside its field
- No `alert()` remains in `src/components/admin/order/`
- Errors linked with `aria-describedby`

---

### FS-502 · Distinguish empty from error on admin screens
**P2 · M · Frontend**

Several admin screens render an empty table when a fetch fails, which reads as "no data"
rather than "could not load".

**Acceptance**
- Every admin list handles loading, empty, error and zero distinctly
- The error state names what failed and offers Retry
- A failed load never renders as emptiness

---

### FS-503 · Server-render the wallet page
**P3 · S · Frontend**

The wallet renders a skeleton then fetches. Correct for cache safety, but a visible loading step
every visit.

**Acceptance**
- Balance rendered in the first paint via an RSC fetch with `no-store`
- Still never cached
- Interactive sections stay client components

---

### FS-504 · Remove stray `console.log` from API routes
**P3 · XS · Backend**

Six calls add noise to the function logs you read when something is wrong.

**Acceptance**
- Removed or promoted to `console.warn`/`console.error` where they carry meaning
- Wallet logging conventions unchanged

---

### FS-505 · Show the active passbook filter
**P3 · XS · Frontend**

Clicking a category filters the passbook, but only a "Clear" button indicates it.

**Acceptance**
- The active category is named above the table with its colour swatch

---

### FS-506 · Narrow `images.remotePatterns`, enable optimisation
**P2 · M · Full-stack**

`remotePatterns` contains a wildcard, so `unoptimized: true` is currently the safe setting.
Enabling optimisation first would let arbitrary hosts through the image proxy.

**Acceptance**
- Real hosts enumerated from production data
- Wildcard entries removed
- `unoptimized: false`
- No broken images after deploy
- Transformation budget monitored

---

### FS-507 · Lighthouse pass on the wallet
**P2 · S · Frontend**

**Acceptance**
- Performance 100 and Accessibility 100, mobile and desktop
- CLS < 0.1
- Verified in CI or a documented manual run

---

### FS-508 · Analytics dashboard
**P3 · M · Full-stack**

`/admin/analytics` currently redirects to `/admin`. The component was removed as dead code.

**Acceptance**
- Revenue by period, orders by status, top products, tier split
- Uses `recharts`, already a dependency
- Aggregated server-side
- Date range via `DateRangePicker`

---

# E6 — Quality and polish

### FS-601 · Wallet receipt in the transaction email
**P3 · S · Backend**

Expense emails describe the transaction but do not attach the receipt.

---

### FS-602 · Bulk wallet operations
**P3 · M · Full-stack**

Recording the same expense across many customers (an annual filing fee) is one at a time.

**Acceptance**
- Select customers, one category, one amount
- Preview total impact before applying
- Each customer receives an individual ledger entry and notification
- One idempotency key per customer

---

### FS-603 · Wallet balance in the customer list
**P3 · S · Frontend**

Staff must open each customer to see a balance.

**Acceptance**
- A balance column on the admin customer list
- **One aggregated query keyed by `userId`** — never one request per row

---

### FS-604 · Low-balance reminder
**P3 · S · Backend**

`lowBalanceThreshold` exists and drives a banner but sends nothing.

**Acceptance**
- Email when a balance first drops below the threshold
- Sent once per crossing, not daily
- Folded into the existing maintenance job

---

### FS-605 · Export the audit trail
**P3 · S · Backend**

**Acceptance**
- Admin export of all staff money actions for a period
- Includes actor, IP, timestamp, amount, customer
- Same CSV formula-injection guard as the statement

---

### FS-606 · Accessibility audit of the storefront
**P2 · M · Frontend**

The wallet was built to the standard; older storefront screens were not audited.

**Acceptance**
- Every storefront page reaches Lighthouse Accessibility 100
- Product detail keyboard-navigable end to end
- Carousels honour reduced motion

---

### FS-607 · Document the deployment runbook
**P3 · S · Docs**

The pre-deployment checklist exists in two documents but there is no single runbook.

**Acceptance**
- One runbook: env vars, index sync, smoke tests, rollback
- Linked from the README

---

# Suggested sequence

```
Sprint 0   FS-101 102 103 104              one afternoon — four critical one-liners
           FS-105 106 107 108              the rest of the security work
Sprint 1   FS-201 202 203 204              finish the wallet
Sprint 2   FS-301 304                      stop the duplication bugs
           FS-501 502                      UI consistency
Sprint 3   FS-401                          the most requested product gap
           FS-506 507                      performance
Sprint 4   FS-302 303                      structural, one at a time
```

**FS-101, FS-102 and FS-103 are one-line changes with critical impact.** They should not wait
for a sprint boundary.

---

# External blockers

| Blocks | Owner | Question |
|---|---|---|
| GST invoicing for wallet services | Chartered accountant | Which expense categories are a taxable supply? |
| Launch | Legal counsel | Business Wallet: service fee, or third-party pass-through? |
| Launch | Designer | *Full Control Always Yours* is not true as built — *Full Transparency Always Yours* is |
| Closure policy | Business owner | Leftover balance on closure — currently case-by-case with a mandatory reason |
| Cheque clearing | Chartered accountant | How long before a pending cheque credit is confirmed? |
