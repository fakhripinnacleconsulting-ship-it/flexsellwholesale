# Product Requirements Document — FlexSell Wholesale

| Field | Value |
|---|---|
| **Product** | FlexSell Wholesale |
| **Document version** | 2.0 |
| **Date** | 15 August 2026 |
| **Status** | Live in production |
| **Author** | Engineering |
| **Reviewers** | Business owner · Chartered accountant (§11) · Legal counsel (§11) |

---

## Table of contents

1. [Purpose and scope](#1-purpose-and-scope)
2. [Personas](#2-personas)
3. [Product principles](#3-product-principles)
4. [Functional requirements](#4-functional-requirements)
5. [User stories with acceptance criteria](#5-user-stories-with-acceptance-criteria)
6. [Business rules](#6-business-rules)
7. [Non-functional requirements](#7-non-functional-requirements)
8. [Out of scope](#8-out-of-scope)
9. [Success metrics](#9-success-metrics)
10. [Dependencies](#10-dependencies)
11. [Open decisions](#11-open-decisions)
12. [Glossary](#12-glossary)

---

## 1. Purpose and scope

### 1.1 The problem

A manufacturer or distributor selling to retail buyers, wholesale buyers and resellers
simultaneously faces a structural problem: **the same physical product sells at three different
prices to three different audiences**, with different minimum quantities, different invoicing
obligations and different fulfilment addresses.

The obvious solution — three storefronts — triples the catalogue work, splits the inventory
count, and guarantees the three drift apart.

### 1.2 The approach

One catalogue. One inventory pool. One order pipeline. **Price is a resolved value**, derived
at read time from the signed-in customer's entitlement, never stored on a cart or a session.

A customer may hold more than one tier (`customerTypes: ["B2C", "B2B"]`), which is why
entitlement is resolved rather than assigned.

### 1.3 In scope

Catalogue, multi-tier pricing, cart and checkout, GST-compliant invoicing, order fulfilment,
dropshipping, prepaid wallets, customer accounts with KYC, a permission-scoped staff role,
CMS-driven content, and operational tooling (coupons, reviews, inquiries, shipping, HSN,
analytics).

### 1.4 Out of scope

See [§8](#8-out-of-scope).

---

## 2. Personas

### P1 — Retail buyer (B2C)

Buys one or two units at list price. No verification, no minimum quantity. Wants a fast,
familiar shopping experience.

**Needs:** browse, search, buy, track. **Frustrated by:** account friction, hidden costs.

### P2 — Wholesale buyer (B2B)

Buys in bulk for their own shop. Needs a GST tax invoice for input credit, and cares about
per-unit price at quantity.

**Needs:** wholesale price visibility, MOQ clarity, bulk variant entry, tax invoices, quotes
for negotiated pricing.
**Frustrated by:** entering quantities one variant at a time, invoices missing HSN detail.

### P3 — Reseller (Dropshipping)

Never holds stock. Lists FlexSell products on their own channel and forwards orders. The
shipment goes to **their** customer.

**Needs:** reseller pricing, order entry with an end-customer address, Amazon order references,
no FlexSell branding on the shipment.
**Frustrated by:** flows that assume the buyer and the recipient are the same person.

### P4 — Operations manager (staff)

Runs day-to-day operations within the permissions an admin grants. Processes orders, answers
inquiries, records business expenses against customer wallets.

**Needs:** to act without waiting for approval. **Frustrated by:** permission walls mid-task.

### P5 — Business owner (admin)

Owns the commercial relationship and every irreversible decision — creating money, returning
it, closing accounts.

**Needs:** to see what staff are doing without opening each record. **Frustrated by:** anything
that hides activity.

---

## 3. Product principles

| # | Principle | Consequence in the product |
|---|---|---|
| 1 | **One catalogue, three prices** | Price resolves from entitlement; never duplicated per tier |
| 2 | **The ledger is the truth** | Money records are append-only; corrections are visible as corrections |
| 3 | **Detection over prevention** | Staff act immediately; every action is named, evidenced and notified |
| 4 | **Never confuse "empty" with "broken"** | A failed balance load must never render as ₹0 |
| 5 | **Indian by default** | IST timestamps, ₹ with lakh grouping, financial year 1 April – 31 March |
| 6 | **Explain, don't just block** | Every refusal names the reason and the next step |

---

## 4. Functional requirements

### 4.1 Catalogue — `FR-CAT`

| ID | Requirement | Priority |
|---|---|---|
| FR-CAT-01 | A product has colour variants; each colour has size × weight sub-variants | Must |
| FR-CAT-02 | Price, stock, SKU and barcode are held **per sub-variant** | Must |
| FR-CAT-03 | Each sub-variant carries MRP, B2C, B2B and Dropshipping prices | Must |
| FR-CAT-04 | MOQ is set per sub-variant and applies to B2B buyers only | Must |
| FR-CAT-05 | Products carry an HSN code and GST rate; `priceIncludesGst` decides inclusive or exclusive | Must |
| FR-CAT-06 | Packaging charge is settable at product, colour or sub-variant level, per unit or per order | Should |
| FR-CAT-07 | A+ content blocks: text, image, image+text, feature list | Should |
| FR-CAT-08 | Barcodes generated automatically, entered manually, or read from an image | Should |
| FR-CAT-09 | Stock adjustable by camera scan, USB scanner, manual edit or CSV import — every change logged | Must |
| FR-CAT-10 | Categories are hierarchical; collections are manual or rule-based | Must |
| FR-CAT-11 | Weighted text search across title, SKU and barcode, with fuzzy fallback | Must |

### 4.2 Pricing and entitlement — `FR-PRICE`

| ID | Requirement | Priority |
|---|---|---|
| FR-PRICE-01 | Price resolves from the signed-in customer's `customerTypes` at read time | Must |
| FR-PRICE-02 | A multi-tier customer sees the best price they are entitled to | Must |
| FR-PRICE-03 | Signed-out visitors see B2C pricing | Must |
| FR-PRICE-04 | B2B pricing requires an approved KYC | Must |
| FR-PRICE-05 | A Dropshipping-only customer cannot use the standard checkout | Must |
| FR-PRICE-06 | Shipping is weight-based, using the greater of actual and volumetric weight | Must |

### 4.3 Ordering — `FR-ORD`

| ID | Requirement | Priority |
|---|---|---|
| FR-ORD-01 | The order is created **before** payment begins | Must |
| FR-ORD-02 | Stock is reserved at order creation and restored on cancellation | Must |
| FR-ORD-03 | Unpaid online orders are cancelled automatically and stock returned | Must |
| FR-ORD-04 | The fulfilment stepper is append-only — never rewritten or rewound | Must |
| FR-ORD-05 | Each event carries a customer-safe note and a staff-only note | Must |
| FR-ORD-06 | The customer never sees a staff name in the stepper; staff always do | Must |
| FR-ORD-07 | Dispatch supports self-delivery (auto tracking ID) and third-party courier | Must |
| FR-ORD-08 | An estimated delivery date is required to dispatch | Must |
| FR-ORD-09 | Marking delivered requires confirmation and **locks** fulfilment | Must |
| FR-ORD-10 | Shipment details are editable before delivery; edits append, never rewind status | Must |
| FR-ORD-11 | Customers may cancel only before fulfilment begins | Must |

### 4.4 Invoicing and tax — `FR-INV`

| ID | Requirement | Priority |
|---|---|---|
| FR-INV-01 | Three document types: quote, receipt, tax invoice — sequentially numbered | Must |
| FR-INV-02 | CGST + SGST intra-state; IGST inter-state, decided from the buyer's state | Must |
| FR-INV-03 | Tax invoices show an HSN-wise slab breakdown | Must |
| FR-INV-04 | A quote converts to an order at the quoted price, bypassing live price checks | Must |
| FR-INV-05 | Only the quote's owner may convert it | Must |
| FR-INV-06 | Documents are printable and downloadable as PDF | Must |

### 4.5 Wallets — `FR-WAL`

| ID | Requirement | Priority |
|---|---|---|
| FR-WAL-01 | Two wallets per customer: Store (all) and Business (B2B/Dropshipping) | Must |
| FR-WAL-02 | Every movement creates a ledger entry with a unique receipt number | Must |
| FR-WAL-03 | Entries are never edited or deleted; corrections are reversals referencing the original | Must |
| FR-WAL-04 | Every staff-created entry names its author, **visible to the customer** | Must |
| FR-WAL-05 | Customers top up via Razorpay, min ₹500 max ₹2,00,000, enforced server-side | Must |
| FR-WAL-06 | Admins record offline receipts (cash, bank, UPI, cheque) with mandatory proof | Must |
| FR-WAL-07 | Cheques are recorded as pending until cleared | Must |
| FR-WAL-08 | Staff record expenses against an admin-managed category; managers must attach a bill | Must |
| FR-WAL-09 | Spend is grouped by category over any date range | Must |
| FR-WAL-10 | Store Wallet is a checkout payment method; the shortfall is named when short | Must |
| FR-WAL-11 | Cancelling a wallet-paid order refunds into the wallet it was paid from | Must |
| FR-WAL-12 | Transfers are Store → Business only, admin only, and irreversible | Must |
| FR-WAL-13 | Balance is non-refundable, disclosed and acknowledged **on every top-up** | Must |
| FR-WAL-14 | Business Wallet may be funded before KYC, but not spent until approved | Must |
| FR-WAL-15 | Passbook shows opening and closing balances and exports to CSV | Must |
| FR-WAL-16 | Balances reconcile against the ledger nightly; drift alerts, never auto-corrects | Must |
| FR-WAL-17 | Admins may freeze or close a wallet with a recorded reason; history is retained | Must |

### 4.6 Accounts — `FR-ACC`

| ID | Requirement | Priority |
|---|---|---|
| FR-ACC-01 | Registration by email + OTP, or Google | Must |
| FR-ACC-02 | Customers request an upgrade to B2B or Dropshipping | Must |
| FR-ACC-03 | Upgrades require KYC documents; admin approves or rejects with a reason | Must |
| FR-ACC-04 | KYC requirements differ by tier and are validated before approval | Must |
| FR-ACC-05 | Address book with a default address | Should |
| FR-ACC-06 | Account locks for 15 minutes after 10 failed sign-ins | Must |

### 4.7 Staff — `FR-STAFF`

| ID | Requirement | Priority |
|---|---|---|
| FR-STAFF-01 | Managers hold a permission list granted by an admin | Must |
| FR-STAFF-02 | Manager sign-in requires OTP | Must |
| FR-STAFF-03 | Suspending a manager revokes access | Must |
| FR-STAFF-04 | Managers may spend wallets; only admins may create, return or move money | Must |
| FR-STAFF-05 | Actions above ₹50,000 require the admin's password again | Must |
| FR-STAFF-06 | Permission scope is stated in the granting UI where it is broader than it looks | Must |

### 4.8 Content and operations — `FR-OPS`

| ID | Requirement | Priority |
|---|---|---|
| FR-OPS-01 | Homepage sections are reorderable and individually hideable | Should |
| FR-OPS-02 | Banner sections support carousels and grids, with desktop and optional mobile art | Should |
| FR-OPS-03 | Blogs, policies, FAQ and announcements are CMS-managed | Should |
| FR-OPS-04 | Coupons: percentage or fixed, with minimum order and usage caps | Should |
| FR-OPS-05 | Reviews are moderated before publication | Should |
| FR-OPS-06 | Inquiries route to typed inboxes: wholesale, dropshipping, support, franchise, general | Should |
| FR-OPS-07 | Notifications by in-app, email and web push, with per-category preferences | Should |
| FR-OPS-08 | An analytics dashboard shows revenue, orders and top products | Could |

---

## 5. User stories with acceptance criteria

### US-01 — Wholesale buyer orders in bulk
> **As** a B2B buyer, **I want** to enter quantities for every variant on one screen, **so that**
> I do not add twenty SKUs one at a time.

**Acceptance**
- Given an approved B2B account, when I open a product, then I see a variant matrix with a
  quantity field per sub-variant
- And prices shown are B2B prices
- And a sub-variant below its MOQ shows the minimum and blocks that line
- And out-of-stock sub-variants are disabled with the reason shown
- When I add to cart, then every quantity is added in one action

### US-02 — Buyer pays from the Store Wallet
> **As** a customer with a balance, **I want** to pay from my wallet, **so that** I skip the
> payment gateway.

**Acceptance**
- Given a positive Store Wallet balance, when I reach Payment Method, then Store Wallet appears
  with the balance shown
- Given the balance is below the total **including shipping**, then the option is disabled and
  names the shortfall (*"₹2,300 short"*) with an Add money link
- When I pay, then the balance drops by exactly the payable total
- And the passbook shows one entry linked to the order
- And submitting twice produces exactly **one** debit

### US-03 — Customer sees where their money went
> **As** a business customer, **I want** to see my spend by category, **so that** I can explain
> it to my accountant.

**Acceptance**
- Given expenses exist, when I open the wallet, then I see a category breakdown with amounts
  and percentages
- And I can change the period, including a custom range
- And the default period is the current Indian financial year
- And clicking a category filters the passbook to it
- And I can export the range as CSV with opening and closing balances
- And a failed load shows an error, **never ₹0**

### US-04 — Manager records a business expense
> **As** an operations manager, **I want** to record an expense against a customer's Business
> Wallet, **so that** their statement stays accurate.

**Acceptance**
- Given `wallet_business`, when I open a customer, then I see the Wallets panel
- When I record an expense without a bill, then it is rejected
- When I confirm, then the dialog names the amount and the customer
- And the entry shows **my name** in the customer's passbook
- And the customer receives an email naming me
- And the admin receives an alert stating whether a bill was attached
- And double-clicking produces exactly one debit
- Given the customer's KYC is not approved, then the expense is refused with that reason

### US-05 — Admin records a cash payment
> **As** an admin, **I want** to record cash received at the office, **so that** the customer's
> balance reflects it.

**Acceptance**
- Given I am an admin, when I open Add Funds Offline, then I choose cash, bank, UPI or cheque
- When I submit without proof, then it is rejected
- When the source is cash and there is no note, then it is rejected
- When the source is bank/UPI/cheque and there is no reference, then it is rejected
- When the amount is ₹50,000 or more, then my password is required
- When the source is cheque, then the entry is pending and the balance does **not** rise
- And the credit appears in the offline register with my name and IP
- And the customer is notified

### US-06 — Customer cancels a wallet-paid order
> **As** a customer, **I want** my money back when I cancel, **so that** I can order again.

**Acceptance**
- Given a wallet-paid order before fulfilment, when I cancel, then the balance is restored
- And the passbook shows a REFUND entry referencing the original debit
- And stock is returned
- And cancelling twice refunds **once**
- And a Business-Wallet-funded order refunds to the Business Wallet, never the Store Wallet

### US-07 — Reseller places a dropship order
> **As** a reseller, **I want** to enter my customer's address, **so that** the parcel ships
> directly to them.

**Acceptance**
- Given a Dropshipping account, when I open the Hub, then I enter the end customer's details
- And I may record an Amazon order and invoice reference
- And I am charged the Dropshipping price
- And the shipping label carries the end customer's address

### US-08 — Admin approves an upgrade
> **As** an admin, **I want** to verify KYC before granting wholesale pricing, **so that** only
> genuine businesses receive it.

**Acceptance**
- Given a pending request, when I open the customer, then I see the requested tiers and their
  documents
- When required documents are missing, then approval is blocked and names what is missing
- When I approve, then the tier is added and the customer is notified
- When I reject, then a reason is required and sent
- Given a pure B2C customer, then the KYC section is not shown at all

---

## 6. Business rules

Rules a new engineer would otherwise get wrong.

| # | Rule | Rationale |
|---|---|---|
| BR-01 | Price is resolved, never stored on the cart | A customer upgraded mid-session must immediately see the new price |
| BR-02 | Order is created before payment starts | The order binds the payment to a server-computed price; paying first leaves the gateway nothing to settle |
| BR-03 | Stock is reserved at order creation | Which is why abandoned orders must be reaped |
| BR-04 | Wallet money is reserved, then captured | Debiting before the order exists can leave a customer poorer with nothing to show |
| BR-05 | All timestamps are IST, formatted in one module | A UTC timestamp on an Indian invoice is wrong by 5½ hours |
| BR-06 | Wallet money is paise; the rest of the app is rupees | Float rupees drift; conversion happens once, at the API edge |
| BR-07 | Delivery locks fulfilment | Amending a delivered shipment rewrites history rather than correcting a live mistake |
| BR-08 | The financial year starts 1 April | 31 March 2026 belongs to FY 2025-26 |
| BR-09 | Business Wallet money never returns to the Store Wallet | It is services-only and non-refundable; a return path would undo both |
| BR-10 | Reconciliation reports, never repairs | An auto-fix hides the bug that caused the drift |
| BR-11 | Deactivating a category blocks new spend but preserves old rows | Otherwise past statements break |
| BR-12 | Actor identity always comes from the session | A client-supplied name is a forged signature |

---

## 7. Non-functional requirements

### 7.1 Performance

| ID | Requirement | Target |
|---|---|---|
| NFR-P-01 | Product page LCP | < 2.5s on 4G |
| NFR-P-02 | Product page interactive after a card click | < 1s (route prefetched on intent) |
| NFR-P-03 | Wallet page interactive | < 2s |
| NFR-P-04 | Lighthouse Performance, mobile and desktop | 100 |
| NFR-P-05 | Aggregations computed in the database | No client-side summation |
| NFR-P-06 | Lists paginated server-side | 50 rows per page |

### 7.2 Reliability

| ID | Requirement |
|---|---|
| NFR-R-01 | A lost payment webhook must not require the customer to contact support |
| NFR-R-02 | Money operations are idempotent in both directions |
| NFR-R-03 | Concurrent debits can never overdraw a wallet |
| NFR-R-04 | A half-committed transfer must be impossible |
| NFR-R-05 | Balances reconcile against the ledger nightly, with an alert on drift |

### 7.3 Security

| ID | Requirement |
|---|---|
| NFR-S-01 | All state-changing requests carry a CSRF token |
| NFR-S-02 | Passwords are bcrypt-hashed and never returned by an API |
| NFR-S-03 | Payment amounts always come from a server-stored record |
| NFR-S-04 | Permissions re-read from the database on every request |
| NFR-S-05 | Money-creating actions above ₹50,000 require re-authentication |
| NFR-S-06 | Auth endpoints are rate-limited |
| NFR-S-07 | Uploaded identity documents are not publicly retrievable *(open — FS-106)* |

### 7.4 Accessibility

| ID | Requirement |
|---|---|
| NFR-A-01 | Lighthouse Accessibility 100, mobile and desktop |
| NFR-A-02 | Every flow completable by keyboard alone |
| NFR-A-03 | Colour is never the only carrier of meaning |
| NFR-A-04 | `prefers-reduced-motion` honoured |
| NFR-A-05 | Balances and totals in semantic markup screen readers can announce |

### 7.5 Compatibility

| ID | Requirement |
|---|---|
| NFR-C-01 | Last two versions of Chrome, Safari, Firefox and Edge |
| NFR-C-02 | iOS Safari 16+, Chrome Android 120+ |
| NFR-C-03 | Usable from 360px to 2560px |
| NFR-C-04 | Light and dark themes both fully designed |

### 7.6 Compliance

| ID | Requirement |
|---|---|
| NFR-L-01 | GST-compliant tax invoices with HSN detail |
| NFR-L-02 | Non-refundable balance disclosed before every payment |
| NFR-L-03 | Immutable audit trail for every staff money action |
| NFR-L-04 | Wallet structure confirmed against RBI prepaid-instrument guidance *(open — §11)* |

---

## 8. Out of scope

| Not built | Reason |
|---|---|
| GST invoices for wallet service expenses | Which categories are a taxable supply is the accountant's answer; a wrong document that looks official is worse than none |
| Wallet withdrawal to a bank | Balance is non-refundable by design |
| Split payment (wallet + gateway) | Deferred — FS-401 |
| Customer approval before staff spend | Declined for speed; plumbing exists if reversed — FS-402 |
| Manager spend caps | Declined; cheapest future narrowing — FS-403 |
| Per-customer manager scoping | The relationship does not exist in the data model — FS-404 |
| Multi-currency | India-only product |
| Multi-warehouse inventory | Single pool today |
| Mobile applications | Responsive web only |

---

## 9. Success metrics

| Metric | Target | Measured by |
|---|---|---|
| Ledger integrity | 0 drift events | Nightly reconciliation |
| Duplicate money movements | 0 | Unique index violations logged |
| Wallet support tickets | < 1% of transactions | Support inbox |
| "Where did my money go" answered without support | 100% | Breakdown + passbook usage |
| Stuck top-ups resolved without contact | > 95% | Sweeper credit rate |
| Checkout completion, wallet vs gateway | Wallet ≥ gateway | Funnel |
| Lighthouse Performance / Accessibility | 100 / 100 | CI |

---

## 10. Dependencies

| Dependency | Used for | Failure behaviour |
|---|---|---|
| MongoDB Atlas | Primary store | Hard failure |
| Razorpay | Payments and webhooks | Payments unavailable; wallet balances still spendable |
| Vercel Blob | File storage | Falls back to local disk, then base64 |
| Upstash Redis | Rate limiting | Limiting disabled, app continues |
| SMTP (Nodemailer) | Email | Logged and swallowed — never blocks a transaction |
| Web Push (VAPID) | Browser notifications | Silently skipped |
| Sentry | Error tracking | No user impact |
| Vercel Cron | Scheduled jobs | **Hobby plan: 2 jobs, once daily** — see architecture §7 |

---

## 11. Open decisions

| Decision | Owner | Blocks | Detail |
|---|---|---|---|
| Which expense categories are a taxable supply | Chartered accountant | GST invoicing for services | Determines the document each category emits |
| Business Wallet structure | Legal counsel | Launch | Service fee for FlexSell's own work, or a pass-through of third-party costs — invoiced very differently, and the second reading carries RBI weight |
| Banner copy | Designer | Launch | *Full Control Always Yours* is not true as built — there is no customer approval. *Full Transparency Always Yours* is |
| Leftover balance on wallet closure | Business owner | — | Currently case-by-case with a mandatory recorded reason |
| Cheque clearing period | Chartered accountant | — | How long before a pending cheque credit is confirmed |

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **Sub-variant** | The sellable unit — a size × weight combination within a colour. Carries price, stock, SKU, barcode |
| **Tier** | B2C, B2B or Dropshipping. A customer may hold several |
| **Entitlement** | The resolved pricing a customer qualifies for, computed at read time |
| **MOQ** | Minimum order quantity, per sub-variant, B2B only |
| **HSN** | Harmonised System Nomenclature — the code determining the GST rate |
| **CGST / SGST / IGST** | Central, state and integrated GST. First two intra-state, the third inter-state |
| **Store Wallet** | Prepaid balance for goods and services |
| **Business Wallet** | Prepaid balance for services only, spent by staff on the customer's behalf |
| **Ledger entry** | One immutable money record with before and after balances |
| **Reversal** | The only way to undo an entry — a new opposing entry referencing the original |
| **Hold** | Money reserved for an in-flight checkout; captured on success, released on failure |
| **Idempotency key** | A value making a repeated request safe. `paymentId` for credits, `clientRequestId` for debits |
| **Reconciliation** | The nightly check that each balance equals its ledger |
| **Drift** | A disagreement between a balance and its ledger. Always a bug |
| **Financial year** | 1 April – 31 March, the Indian convention |
| **IST** | Indian Standard Time, UTC+5:30 — the only timezone this product displays |
