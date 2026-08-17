# Security & Access Control Document — FlexSell Wholesale

| Field | Value |
|---|---|
| **Classification** | Internal — contains unremediated findings |
| **Document version** | 2.0 |
| **Date** | 15 August 2026 |
| **Scope** | Whole application: authentication, authorisation, money paths, data protection |
| **Method** | Manual code review of all 88 API routes, guards, models and middleware |

> Live findings with reproduction steps are in [`report.md`](../report.md). This document
> describes the **design** — what protects what, why each control sits where it does, and what
> is knowingly accepted.

---

## Table of contents

1. [Assets and trust boundaries](#1-assets-and-trust-boundaries)
2. [Threat model](#2-threat-model)
3. [Identity](#3-identity)
4. [Authorisation](#4-authorisation)
5. [Money controls](#5-money-controls)
6. [Application security](#6-application-security)
7. [Data protection](#7-data-protection)
8. [Audit trail](#8-audit-trail)
9. [Accepted risk](#9-accepted-risk)
10. [Open findings](#10-open-findings)
11. [Compliance](#11-compliance)
12. [Incident response](#12-incident-response)
13. [Deployment checklist](#13-deployment-checklist)

---

## 1. Assets and trust boundaries

### 1.1 What is worth protecting

| Asset | Impact if compromised |
|---|---|
| **Customer wallet balances** | Direct financial loss; unrecoverable once spent |
| **KYC documents** (Aadhaar, PAN, cheque, GST) | Identity theft; regulatory exposure in India |
| **Admin sessions** | Total compromise — money creation, data deletion |
| **Payment credentials** | Fraudulent transactions |
| **Customer PII** | Privacy breach, reputational damage |
| **Order and invoice records** | Financial dispute; tax exposure |
| **Product pricing** | Competitive harm; a tampered price is direct loss |

### 1.2 Trust boundaries

```
  UNTRUSTED                    │ SEMI-TRUSTED      │ TRUSTED
  ─────────────────────────────┼───────────────────┼──────────────────
  Anonymous visitor            │ Customer session  │ Server runtime
  Request bodies, query params │ Manager session   │ Database
  Uploaded files               │ Admin session     │ Environment vars
  Razorpay webhook payload     │                   │
                               │                   │
  ▲ Everything left of this line is attacker-controlled and must be
    validated server-side, regardless of what the UI enforces.
```

**A staff session is semi-trusted, not trusted.** A compromised manager account is a realistic
scenario, which is why money-creating actions are admin-only and re-authenticated.

---

## 2. Threat model

STRIDE, scoped to this application.

| # | Threat | Vector | Control | State |
|---|---|---|---|---|
| **T-01** | *Spoofing* — forge an admin session | Guess or derive the JWT secret | HTTP-only cookie, signed | ⚠️ `JWT_SECRET` falls back to a committed value — SEC-03 |
| **T-02** | *Spoofing* — act as another customer | Pass someone else's `userId` | Ownership checked server-side | ✅ (was broken on wallet reads — BUG-01, fixed) |
| **T-03** | *Tampering* — pay less than the price | Alter the amount in the request | Amount always read from a stored record | ✅ |
| **T-04** | *Tampering* — settle with a cheaper signature | Replay a different Razorpay order | Order id minted server-side and bound to the record | ✅ |
| **T-05** | *Tampering* — overdraw a wallet | Two simultaneous debits | Conditional atomic update | ✅ |
| **T-06** | *Repudiation* — deny an action | Staff dispute an expense | Immutable actor, IP, IST timestamp | ✅ |
| **T-07** | *Information disclosure* — read KYC documents | Guess a blob URL | — | ❌ Public blobs, enumerable filenames — SEC-02 |
| **T-08** | *Information disclosure* — read another wallet | Enumerate `userId` | Ownership check | ✅ |
| **T-09** | *Denial of service* — credential stuffing | Automated sign-in attempts | Rate limit + lockout | ✅ |
| **T-10** | *Denial of service* — storage exhaustion | Mass anonymous uploads | IP rate limit only | ⚠️ No auth — SEC-01 |
| **T-11** | *Elevation* — manager acts as admin | Call an admin route directly | `requireWalletAdmin`, DB-backed permission reads | ✅ |
| **T-12** | *Elevation* — use a revoked permission | Keep using an old token | DB re-read per request | ⚠️ Three handlers trust the token — SEC-07 |
| **T-13** | *Elevation* — XSS to admin session | Store a payload in CMS content | Sanitised on render | ❌ One unsanitised path — SEC-06 |
| **T-14** | *Tampering* — CSRF a state change | Cross-site form post | Double-submit cookie | ⚠️ Disabled by `TEST_MODE` — SEC-04 |
| **T-15** | *Information disclosure* — mass-assign a role | Send `role: "admin"` in a profile update | Bodies destructured explicitly | ✅ |
| **T-16** | *Tampering* — execute in a customer's spreadsheet | Formula in an expense description | CSV cells prefixed | ✅ |
| **T-17** | *Spoofing* — attribute an action to someone else | Send an actor in the body | Actor always from the session | ✅ |
| **T-18** | *Information disclosure* — silence a victim's alerts | Overwrite their notification preferences | — | ❌ Unauthenticated — SEC-05 |

**T-18 deserves emphasis.** Turning off a target's `security` and `payments` notifications is a
*preparatory* step: the wallet's entire detective-control design assumes those emails arrive.

---

## 3. Identity

### 3.1 Principals

| Principal | Stored as | Sign-in | MFA |
|---|---|---|---|
| Customer | `Customer` | Email+password, Google, OTP | Optional OTP |
| Admin | `Customer` with `role: "admin"` | Same route | — |
| Manager | `Manager` | `manager-login` | **OTP required** |

Admins sharing a collection with customers is architectural debt, not a control. Three queries
carry `role: { $ne: "admin" }` as a **fail-open** workaround; a new query that omits it leaks
admin accounts into a customer list.

### 3.2 Session

- **JWT** in an HTTP-only, `SameSite` cookie. 1-day expiry.
- Payload: `{ userId, email, role, customerTypes?, permissions? }`
- Verified with `jose` in middleware (Edge), `jsonwebtoken` in route handlers (Node).

**`permissions` in the token is a hazard.** Any route trusting that copy honours a revoked
permission for up to 24 hours. The correct pattern re-reads the `Manager` document and checks
`status !== "active"` on every request.

### 3.3 Credentials

| Control | Detail |
|---|---|
| Hashing | bcrypt |
| Lockout | 10 failures → 15 minutes (`failedLoginAttempts`, `lockUntil`) |
| Rate limit | 5 requests/minute, Upstash sliding window |
| Password never returned | `.select("-password")` on every read |
| Reset tokens | Single-use, expiring |
| Timing-safe comparison | CSRF tokens, payment signatures |

Wallet admin re-authentication reuses **the same lockout fields**, so an attacker gains nothing
by attacking that surface instead of the front door.

---

## 4. Authorisation

### 4.1 Permission model

Managers hold a flat list of strings granted at `/admin/managers`:

```
catalog_products · catalog_categories · catalog_collections
orders_b2c · orders_b2b · orders_dropshipping
customers_b2c · customers_b2b · customers_dropshipping
invoices_invoice · invoices_quote · invoices_receipt
inquiries_{wholesale,dropshipping,support,franchise,general}
ops_upgrades · ops_hsn · ops_shipping · ops_coupons
content_reviews · content_cms · system_settings
wallet_store · wallet_business
```

Each supports `:create`, `:read`, `:update`, `:delete`, and a bare grant implies all four.

### 4.2 Not scoped to individuals

**No `assignedCustomers` relationship exists.** `customers_b2b` means *all* B2B customers;
`wallet_business` means *any* customer's Business Wallet.

Accepted, and stated in the granting UI as an amber warning under each wallet checkbox:

> *"Lets this manager spend from ANY customer's Business Wallet. No amount limit."*

An admin must not grant it believing it is narrower than it is.

### 4.3 The widening rule, and where it must not apply

`requireAdminOrManagerAuth` widens a root permission — `orders` implies `orders:update`.
Correct for CRUD.

`verifyManagerOrderAccess` goes further:

```js
if (hasPerm("ops_shipping") || hasPerm("orders")) allowed = true;
```

**The wallet guard deliberately does not inherit this.** Only the exact permission for the
wallet being written grants access — no widening, no wildcard, no fallback. A regression test
pins it: a manager holding both `ops_shipping` and `orders` receives 403.

### 4.4 Permission chosen from the resource

```ts
const auth = await requireWalletSpendAccess(walletType);   // from the wallet being written
```

Never from the request body. A `wallet_business` holder cannot reach a Store Wallet by changing
one field.

### 4.5 Access matrix

| Action | Anon | Customer | Manager | Admin |
|---|---|---|---|---|
| Browse catalogue | ✅ | ✅ | ✅ | ✅ |
| See B2B pricing | ❌ | ✅ if entitled | ✅ | ✅ |
| Place an order | ❌ | ✅ own | ✅ for others | ✅ |
| Cancel an order | ❌ | ✅ own, pre-fulfilment | ✅ scoped | ✅ |
| Dispatch | ❌ | ❌ | ✅ scoped | ✅ |
| Read own wallet | ❌ | ✅ | — | ✅ any |
| Top up own wallet | ❌ | ✅ | ❌ | ❌ |
| Pay an order from wallet | ❌ | ✅ own | ✅ | ✅ |
| Record an expense | ❌ | ❌ | ✅ *no cap* | ✅ |
| Offline / cash credit | ❌ | ❌ | ❌ | ✅ + password |
| Transfer between wallets | ❌ | ❌ | ❌ | ✅ + password |
| Reverse an entry | ❌ | ❌ | ❌ | ✅ + password |
| Freeze / close a wallet | ❌ | ❌ | ❌ | ✅ + password |
| Approve an upgrade | ❌ | ❌ | ✅ with `ops_upgrades` | ✅ |
| Manage managers | ❌ | ❌ | ❌ | ✅ |

---

## 5. Money controls

### 5.1 The core split

> **Managers may SPEND. Only admins may CREATE, RETURN or MOVE money.**

Spending moves money the customer already deposited, against a named expense, fully attributed.
Creating money (offline credit), returning it (refund, reversal) or moving it (transfer) has no
external system verifying it — those are not delegable at all.

### 5.2 Anti-tampering

| Attack | Defence |
|---|---|
| Send a smaller amount | Amount read from the stored order or pending transaction |
| Replay a cheaper signature | Razorpay order id minted server-side, bound to the record |
| Replay the webhook | Unique sparse `paymentId` + conditional `pending → success` flip |
| Double-submit the form | Unique sparse `clientRequestId`, minted when the form **opens** |
| Concurrent overdraw | Conditional atomic update |
| Gateway captures a different amount | Rejected in **both** directions — a larger capture is a mismatch, not a bonus |
| Edit a balance directly | One writer module; nightly reconciliation |
| Spend from a frozen wallet | `status: "active"` in every conditional update |
| Reverse twice | Claim conditional on `status: "success"` |
| Refund a cancelled order twice | Same claim, plus the cancellation's own exclusivity |

### 5.3 Step-up authentication

`ConfirmDialog` **then** the admin's password, for actions ≥ ₹50,000 and any closure holding a
balance.

- Verified **inside the acting route**, in the same request that moves the money — never a
  separate call whose boolean the client replays.
- **No grace window.** A five-minute pass would make the *second* large transfer free, which is
  precisely the one worth stopping.
- The dialog names the **amount and the customer**. "Are you sure?" prevents nothing; the wrong
  customer is the likelier mistake.

### 5.4 Mandatory evidence

| Action | Required |
|---|---|
| Offline credit | Proof file, always |
| Offline credit — cash | A written note (no reference number exists to check) |
| Offline credit — bank/UPI/cheque | A reference number checkable against a statement |
| Manager expense | A bill or invoice |
| Freeze / close | A written reason, shown to the customer |
| Reversal | A written reason, shown on the statement |

---

## 6. Application security

### 6.1 CSRF

Double-submit cookie: `X-CSRF-Token` must match the `csrf_token` cookie, compared timing-safely,
on POST/PUT/PATCH/DELETE.

PATCH is included deliberately — omitting it once left every PATCH route reachable cross-site.

**Exempt paths**, each verifying itself another way:

| Path | Verifies via |
|---|---|
| 7 pre-session auth routes | No session exists to protect |
| `razorpay/webhook` | HMAC over the raw body |
| `system-diagnostics` | Admin session |
| `upload` | Session check inside the route |
| `customers/upload-document` | **Nothing — SEC-01** |

The list names **specific routes, not the `/api/auth/` prefix**: `change-password` acts on an
established session, and a blanket prefix exemption once left it open to a cross-site account
takeover.

### 6.2 Input handling

| Vector | Control | State |
|---|---|---|
| NoSQL / regex injection | `escapeRegex` on all user input | ✅ |
| XSS — blog content | `sanitizeHtml` (DOMPurify) | ✅ |
| XSS — collection description | — | ❌ SEC-06 |
| XSS — JSON-LD | `JSON.stringify` on server-built objects | ✅ |
| CSV formula injection | Cells beginning `= + - @` prefixed with `'` | ✅ |
| Mass assignment | Bodies destructured explicitly | ✅ |
| Schema validation | Zod on auth and order payloads | ✅ |
| Amount validation | `parseAmountToPaise` — positive, integer, bounded, throws | ✅ |

The `sanitizeHtml` **fallback** (used only if DOMPurify throws) strips with regex and misses
unquoted handlers such as `<img src=x onerror=alert(1)>`. A sanitiser that fails should fail
closed — SEC-08.

### 6.3 File uploads

| Control | `/api/upload` | `/api/customers/upload-document` |
|---|---|---|
| Authentication | ✅ | ❌ |
| CSRF | Exempt, session-checked | Exempt, **unchecked** |
| Type allowlist | ✅ client-declared | ✅ client-declared |
| Magic-byte sniffing | ❌ | ❌ |
| Size limit | 10 MB / 30 MB video | 1 MB |
| Rate limit | ✅ | ✅ IP only |
| Storage access | **public** | **public** |

`file.type` is the `Content-Type` the client wrote in the multipart body. It is not sniffed.
Any content can be uploaded by declaring `image/png`.

---

## 7. Data protection

### 7.1 Classification

| Data | Class | At rest | In transit | Access |
|---|---|---|---|---|
| Passwords | Secret | bcrypt | TLS | Never returned |
| **KYC documents** | **PII — high** | **Plain, public URL** | TLS | **Anyone with the URL** |
| Wallet proofs and bills | Confidential | Plain, public URL | TLS | Anyone with the URL |
| Customer PII | Confidential | Plain | TLS | Owner + staff |
| Payment ids | Confidential | Plain | TLS | Owner + staff |
| Staff IPs | Internal | Plain | TLS | Admin only |
| Catalogue | Public | Plain | TLS | Everyone |

**SEC-02 is the most serious open finding.** Identity documents are retrievable by anyone
holding the URL, and `kyc-${Date.now()}-${originalName}` is millisecond-precision — therefore
enumerable — with guessable filenames.

### 7.2 Secrets

| Variable | If missing |
|---|---|
| `MONGODB_URI` | Throws — fails closed |
| `JWT_SECRET` | **Falls back to a committed value — fails open — SEC-03** |
| `RAZORPAY_KEY_SECRET` | Configuration error |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook 500 |
| `CRON_SECRET` | Scheduled routes 403 — fails closed |
| `BLOB_READ_WRITE_TOKEN` | Local disk fallback |

`proxy.ts` reads `JWT_SECRET` with **no fallback** and fails closed. `lib/auth.ts` falls back
and fails **open**. Two files disagree about whether the secret is optional, and the dangerous
one is the default.

### 7.3 Retention

Currently unbounded. Nothing is purged.

| Data | Recommended | Note |
|---|---|---|
| Wallet ledger | **Indefinite** | Financial record; closure retains history by design |
| Orders and invoices | 8 years | Indian tax retention |
| KYC documents | While the account is active + statutory period | Deletion needs a defined trigger |
| OTP records | 24 hours | Should be TTL-indexed |
| Manager login history | 1 year | Bounded array today |
| Stock logs | 2 years | Audit |

**No retention policy is implemented.** Worth defining before the dataset makes it expensive.

---

## 8. Audit trail

Every staff action that moves money records, immutably:

```
createdBy: { userId, name, role }      // captured at write time, from the session
metadata:  { recordedByIp, recordedAt }
```

**At write time, never resolved at read time.** A departed manager would otherwise turn every
past entry into "Unknown", and a rename would silently rewrite history.

**From the session, never the request body** — a client-supplied name is a forged signature.

| Surface | Shows |
|---|---|
| Customer passbook | Every entry, with the staff name — visible to the customer |
| Offline credit register | All non-gateway credits, proof links, admin, IP |
| Daily staff-spend digest | Per manager, per category |
| Nightly reconciliation | Any ledger/balance disagreement |
| Order fulfilment stepper | Customer-safe and internal notes, separately |
| `SECURITY_ALERT` events | Permission denials, drift |

---

## 9. Accepted risk

Recorded so nobody assumes these are oversights.

### AR-01 — No spend caps, approvals or per-customer scoping

**Decision:** staff act immediately.
**Exposure:** any manager with a wallet permission can spend any amount from any customer's
wallet without approval.
**Mitigation:** six detective controls (§5, §8). Two are load-bearing and must never become
optional — the customer notification is the only thing that surfaces a wrong spend, and the
bill is the only thing separating a real expense from an invented one.
**Reversible:** `awaiting_approval` already exists in the enum.

### AR-02 — Balance is non-refundable

**Decision:** no withdrawal.
**Exposure:** a customer who overfunds cannot recover the money.
**Mitigation:** disclosed above the amount field and acknowledged by checkbox on **every**
top-up, versioned and stored on the transaction itself.

### AR-03 — Business Wallet fundable before KYC

**Decision:** money in without KYC; spending requires approval.
**Exposure:** a customer can fund an account that is never approved, and the balance is
non-refundable — money stranded through inaction alone.
**Mitigation:** a blocking warning above the amount field, a separate acknowledgement, KYC
status shown on the wallet page, and a reminder after ~7 days.
**This is the only place in the product where a customer can lose money by doing nothing.**

### AR-04 — Admins share the customer collection

**Decision:** deferred.
**Exposure:** fail-open `$ne: "admin"` filters.
**Mitigation:** wallet routes reject `role === "admin"` explicitly.

---

## 10. Open findings

| ID | Finding | Severity | CVSS-ish | Fix |
|---|---|---|---|---|
| SEC-01 | Unauthenticated file upload | Critical | 7.5 | `requireAuth()`, drop the CSRF exemption, sniff magic bytes |
| SEC-02 | KYC documents at public URLs | Critical | 9.1 | Private blobs + authorising route + UUID names |
| SEC-03 | `JWT_SECRET` falls back to a committed value | Critical | 9.8 *(if unset)* | Throw at module load |
| SEC-04 | `TEST_MODE` disables CSRF and rate limiting | High | 8.1 *(if set)* | Bind to `NODE_ENV !== "production"` |
| SEC-05 | Notification preferences unauthenticated | High | 7.1 | Authenticate; `userId` from the session |
| SEC-06 | Stored XSS in collection descriptions | High | 6.8 | `sanitizeHtml()` |
| SEC-07 | Permissions read from the token, three handlers | Medium | 5.4 | `requireAdminOrManagerAuth` |
| SEC-08 | Sanitiser fallback bypassable | Medium | 4.3 | Fail closed |

**SEC-03, SEC-04 and SEC-06 are one-line changes.** They should not wait for a sprint boundary.

Severity ratings are indicative, for prioritisation — not a formal CVSS assessment.

---

## 11. Compliance

### 11.1 Indian GST

| Requirement | State |
|---|---|
| Tax invoice with GSTIN, HSN, tax breakup | ✅ |
| Intra-state CGST+SGST, inter-state IGST | ✅ |
| Sequential invoice numbering | ✅ Atomic counters |
| Customer GSTIN captured for B2B | ✅ |
| GST treatment of wallet top-up vs spend | ⚠️ Awaiting the accountant |

### 11.2 RBI prepaid instruments

A **closed system PPI** — issued by an entity for buying goods and services **from that entity
only**, with no cash withdrawal and no third-party payments — generally does not require RBI
authorisation. The **Store Wallet fits this comfortably**: it buys FlexSell goods, cannot be
withdrawn, and cannot pay a third party.

The **Business Wallet needs examination.** If its balance pays government fees or advertising
platforms on the customer's behalf, that reads less like closed-loop prepayment and more like
handling money as an agent. The usual clean structure is for FlexSell to charge a **service fee
for its own work** and discharge third-party costs from its own funds.

**Not settled. Confirm with counsel in writing, and make the customer-facing copy match
whichever structure is chosen.**

### 11.3 Data protection

| Principle | State |
|---|---|
| Purpose limitation | ✅ KYC collected only for tier upgrades |
| Storage limitation | ❌ No retention policy — §7.3 |
| Access control | ⚠️ Fails for KYC documents — SEC-02 |
| Consent record | ✅ Terms acknowledged and versioned per top-up |
| Right to erasure | ❌ No implemented flow |

### 11.4 Payments

| Requirement | State |
|---|---|
| No card data stored | ✅ Razorpay-hosted checkout |
| Webhook signature verification | ✅ HMAC-SHA256 over the raw body |
| Server-side amount authority | ✅ |
| Idempotent settlement | ✅ Both directions |

---

## 12. Incident response

### 12.1 Detection

| Signal | Means |
|---|---|
| `DRIFT DETECTED` in logs | A balance disagrees with its ledger — **stop wallet writes** |
| Unique-index violations rising | Repeated duplicate attempts — possible replay attack |
| `SECURITY_ALERT` events | Permission denials |
| Offline credit volume spike | Possible internal fraud |
| Lockouts rising | Credential stuffing |

### 12.2 Playbooks

**Suspected wallet compromise**
1. Freeze the affected wallets (`PATCH /api/wallet/status`) — blocks all movement, preserves history
2. Pull the ledger for the period; every entry names its author and IP
3. Reverse fraudulent entries — never edit
4. Rotate the acting staff account's credentials, or suspend it
5. Reconcile and confirm drift returns to zero

**Suspected admin compromise**
1. Rotate `JWT_SECRET` — invalidates **every** session immediately
2. Review the offline credit register for the period
3. Review the staff-spend digest
4. Rotate Razorpay keys if payment routes may have been touched

**Reconciliation drift**
1. Do not auto-correct
2. Identify the wallet and the period from the alert
3. Replay the ledger — `balanceBefore` and `balanceAfter` on every entry make this exact
4. Find the write path that skipped the ledger; fix the cause
5. Correct with an audited `ADJUSTMENT` naming the incident

**Leaked KYC document**
1. Delete the blob
2. Identify the customer from the filename and the account
3. Notify them
4. Prioritise SEC-02

### 12.3 Rotation

| Secret | When |
|---|---|
| `JWT_SECRET` | On suspected compromise — logs everyone out |
| Razorpay keys | Via the Razorpay dashboard, then Vercel |
| `CRON_SECRET` | Any time; only affects scheduled jobs |
| Admin passwords | Quarterly |

---

## 13. Deployment checklist

**Before every production deploy**

- [ ] `JWT_SECRET` set, ≥ 32 random bytes
- [ ] `TEST_MODE` **absent**
- [ ] `CRON_SECRET` set
- [ ] `npm run sync-indexes` run — unique indexes **are** the duplicate-payment guarantee
- [ ] `NEXT_PUBLIC_SITE_URL` correct, no trailing slash
- [ ] Razorpay webhook subscribed to `payment.captured`
- [ ] `npm run typecheck && npm run test && npm run build` all pass

**Before the wallet goes live**

- [ ] Wallet permissions granted to as few managers as possible
- [ ] Reconciliation alert routed somewhere a human reads daily
- [ ] Offline-credit digest recipient confirmed
- [ ] One real ₹500 top-up completed and reconciled
- [ ] One real expense recorded; both emails received
- [ ] Accountant sign-off (§11.1)
- [ ] Counsel sign-off (§11.2)
