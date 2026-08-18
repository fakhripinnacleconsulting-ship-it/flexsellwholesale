# Migration Runbook — FlexSell Wholesale

Scripts written and tested, **none yet run against production**. Order matters: each one
assumes the previous has completed.

> **Take a full MongoDB backup first.** Not optional. Every script writes its prior value to a
> `_migrationBackup` field and supports `--rollback`, but a backup is the only thing that
> covers a mistake the scripts themselves cannot see.

---

## ⚠️ Before anything else — the wallet is running without its indexes

`dbConnect` sets `autoIndex: false` in production ([dbConnect.ts:34](src/lib/dbConnect.ts#L34)),
so indexes exist only when `sync-indexes.mjs` has been run out of band. **If that has not
happened since the wallet shipped, its unique indexes were never enforcing anything** — and
the ledger's idempotency *is* those indexes, not an application-level check
([walletLedger.ts:237](src/lib/walletLedger.ts#L237)):

| Missing index | Consequence while absent |
|---|---|
| `walletTransactions.paymentId` | A replayed Razorpay webhook **credits the wallet twice** |
| `walletTransactions.clientRequestId` | A double-clicked form **debits or credits twice** |
| `walletTransactions.receiptNumber` | Two ledger entries share a receipt number |
| `wallets.{userId, type}` | A customer gets **two wallets of one type**, balance split across them |

This is a live money-correctness risk and it is **independent of any deploy** — it is worth
fixing before shipping anything else.

`createIndex` with `unique: true` **fails if duplicates already exist**, so check first:

```bash
node scripts/check-index-readiness.mjs      # read-only, writes nothing
```

A clean report means `sync-indexes.mjs` will succeed. Duplicates must be resolved by hand:
deciding which of two conflicting money records is real is a judgement call, not a script's.
For a duplicated `clientRequestId` or `paymentId` the usual answer is that one entry is a
genuine double-charge — **reverse it through the admin reversal flow, never delete it**; the
ledger is append-only.

---

## Order of operations

```bash
# 0. Readiness check, then indexes. The wallet's idempotency depends on these, and the
#    unique index on sourceReceiptId is also what stops step 2 double-issuing an invoice.
node scripts/check-index-readiness.mjs
node scripts/sync-indexes.mjs

# 1. Receipt → invoice renumbering. Also backfills issuedAt, which is what fixes
#    the 12:00 AM timestamps on the manager's Documents pages.
node scripts/migrate-receipt-invoices.mjs            # dry run → review
node scripts/migrate-receipt-invoices.mjs --apply

# 2. Proxy URLs → direct references. Until this runs, historic documents keep
#    costing two billed egresses per view.
node scripts/migrate-document-urls.mjs               # dry run → review
node scripts/migrate-document-urls.mjs --apply

# 3. orderType backfill.  ⚠️ REVIEW THE ACCESS DIFF — see below.
node scripts/backfill-order-types.mjs                # dry run → review
node scripts/backfill-order-types.mjs --apply

# 4. Order history timestamps — pending since the IST work, unrelated to the wallet
#    but never run. Without it, legacy history steps have no real instant to render.
node scripts/migrate-order-timestamps.mjs            # dry run → review
node scripts/migrate-order-timestamps.mjs --apply

# 5. Orphan blob report. Deletion is a separate, later decision.
node scripts/sweep-orphan-blobs.mjs                  # report only
```

Every script reads `MONGODB_URI` from the environment or from `.env.production`,
`.env.local`, `.env` in that order, and prints which file it used.

---

## What each script does

### 1. `sync-indexes.mjs`
Creates every index declared in the Mongoose schemas. `dbConnect` sets `autoIndex: false` in
production, so new indexes do not appear on their own. Idempotent.

**New in this round:** `invoices.sourceReceiptId` (unique, sparse), `invoices.issuedAt`,
`invoices.walletTransactionId`.

### 2. `migrate-receipt-invoices.mjs`
Finds every `type: "invoice"` document whose `_id` is outside the `INV-` series — the result of
the old settlement path flipping `type` in place on a `REC-` document, which MongoDB will not
renumber because `_id` is immutable.

For each: issues a correctly-numbered `INV-` sibling, reverts the original to the paid
**receipt** it always was, links the two, and repoints the order's `invoiceId`.

**Nothing is deleted.** The receipt remains as the audit record of what was collected. The
`INV-` counter is seeded above the highest number already in the data, so no number is reused.

### 3. `migrate-document-urls.mjs`
Rewrites `/api/customers/document/<name>?url=<blobUrl>` down to the bare `<blobUrl>`.

Covers `customers.kycDocuments.*`, `wallettransactions.proofUrl`,
`orders.shipmentDetails.uploadShippingLabel`, `orders.dropshipDetails.*`,
`invoices.dropshipDetails.*`.

Until it runs, those documents are still served through the function proxy — correct and now
authenticated, but still billing egress twice.

### 4. `backfill-order-types.mjs`

> ⚠️ **This one changes access, not just display.** Manager RBAC scopes by `orderType`, so
> giving an order a type can make it **appear for one manager and disappear for another**.

The dry run prints a **per-manager access diff** against the current baseline (an untyped order
is presently treated as B2B). Read it. If a manager's visibility changes in a way you did not
expect, stop and check that manager's permissions before applying.

Only orders with a **missing** type are assigned. An order that already carries one is never
rewritten — a stored value was a decision someone made.

It deliberately does **not** infer from line-item price tiers. That inference is the bug being
fixed; reproducing it here would bake it into the data permanently.

### 5. `sweep-orphan-blobs.mjs`
Lists the store, diffs against every reference in Mongo, and reports objects nothing points at.

**Report-only by default.** Blob deletion is the single irreversible step in this whole
remediation — a mistake loses a customer's KYC document with no way back. Read the report,
satisfy yourself the references are genuinely gone, and only then pass `--apply`.

Objects younger than 24 hours are skipped, since an in-flight upload has no database row yet.

---

## After the migrations

| Check | Expected |
|---|---|
| Any `type: "invoice"` with a `REC-` id | none |
| Any stored URL containing `/api/customers/document/` | none |
| Any order with no `orderType` | none |
| Manager order visibility | matches the reviewed access diff |
| Blob data transfer, 7 days on | **< 10%** of the pre-change baseline |

The last row needs a **before** figure. Capture it from
**Vercel → Storage → fakhri-blob → Open in Observability** before deploying, or there is
nothing to compare against.

---

## Rollback

```bash
node scripts/migrate-document-urls.mjs --rollback --apply
node scripts/backfill-order-types.mjs --rollback --apply
```

Code changes revert by deploy. `migrate-receipt-invoices.mjs` has no rollback by design —
it only ever *adds* correctly-numbered documents and never destroys the originals, so the
recovery for a bad run is to void the new invoices, not to unwind the data.

Blob deletion cannot be rolled back at all. That is why step 5 is report-only.
