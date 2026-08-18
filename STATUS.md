# Remediation status — [plan.md](plan.md) execution

**Build:** ✅ compiled successfully, with type checking **enabled** (`ignoreBuildErrors` removed)
**Types:** ✅ `npx tsc --noEmit` — 0 errors (was 9)
**Tests:** ✅ 304 passed / 26 files (was 293 / 25) — 11 new regression tests

---

## The two reported bugs

| | Before | After |
|---|---|---|
| **Zero-balance wallet settles a receipt** | `handleConfirmPay` never called the wallet; the API wrote `paymentStatus: "Paid"` unconditionally | Settlement runs through `/settle`, which reserves → captures via the wallet engine. A short balance returns **409** and nothing changes. Blocked at four layers: modal button disabled, hook validation, `PUT` rejects payment fields, `POST` rejects wallet+Paid |
| **Invoice carries the receipt number** | `findByIdAndUpdate(id, { type: "invoice" })` — `_id` is immutable, so `REC-01001` stayed | A **separate** `INV-` document is created via `generateNextId("invoice")`; the receipt is retained, marked paid, and linked both ways |

---

## Phases

| Phase | Status | What landed |
|---|---|---|
| **1 — Stop the bleeding** | ✅ | M-4: `admin-pay-order` now uses `requireWalletSpendAccess(walletType)` + an order/customer ownership check. M-5: `PUT /api/invoices/[id]` rejects `paymentStatus`/`paymentMethod`/`transactionId`; `POST /api/invoices` rejects wallet+Paid and requires a reference for any Paid document |
| **2 — Settle endpoint** | ✅ | [`POST /api/invoices/[id]/settle`](src/app/api/invoices/[id]/settle/route.ts). Two-document model on `Invoice` (`sourceReceiptId` unique sparse, `settledByInvoiceId`, `walletTransactionId`, `walletType`, `issuedAt`). Compensating refund on failure, mirroring `/wallet/pay-order`. Migration script written (dry-run default) |
| **3 — UI rewiring** | ✅ | Pay modal takes `payAmount`, disables confirm on a short balance and names the shortfall, requires a reference for non-wallet methods, and no longer invents `CASH-HAND-<timestamp>`. `useInvoiceForm` blocks wallet+Paid at creation. `handleConfirmOrder` creates wallet orders Pending then calls `adminPayOrder`. M-6: dead `"BusinessWallet" ? "Wallet" : "Wallet"` ternary replaced; provenance now lives in `order.walletType` |
| **4 — Authorisation** | ✅ | A-1: exact-action permission checks on invoice update/delete (`:read` no longer grants delete). A-3: rate limit on `/api/coupons/validate`. A-4: `/api/upload` removed from the CSRF exemption list. A-5: per-actor rate limits on `expense`, `transfer`, `reverse`, `credit-offline`, `pay-order`, `admin-pay-order` |
| **5 — Integrity** | ✅ | D-2: invoice immutability inverted to an allowlist (`notes`, `isArchived`, `status`) — `customerGstin` and `sellerInfo` are no longer editable post-issue. D-3: invoice stock deduction now has a `stock: { $gte: qty }` guard and rolls back every taken line on failure instead of swallowing errors. D-4: `issuedAt: Date` added and indexed. 70 lines of dead `syncMissingInvoicesForOrders` removed |
| **6 — Quality** | ✅ | Q-1: all 9 `addToast({ title })` calls fixed (they rendered `[object Object]`), `ignoreBuildErrors` deleted. Q-3: 11-test regression suite |
| **7 — Production migration** | ⏳ **Yours to run** | See below |

---

## Found during execution, not in the original audit

**Customer wallet checkout was fully broken.** `orderSchema` in [validators.ts](src/lib/validators.ts) accepted only `["Bank Transfer", "Razorpay", "UPI", "COD"]`. `CheckoutView` sends `paymentMethod: "Wallet"`, so every wallet checkout failed Zod validation before it reached the wallet at all — the order was never created and the buyer saw a generic 500. Added `"Wallet"` and `"Cash"` to the enum.

---

## Phase 7 — run against production, in this order

```bash
# 1. Create the new indexes first — the unique index on sourceReceiptId is what
#    stops the migration from double-issuing on a re-run.
node scripts/sync-indexes.mjs

# 2. Dry run. Writes nothing; prints every REC- numbered invoice it would repair.
node scripts/migrate-receipt-invoices.mjs

# 3. Back up, then apply.
node scripts/migrate-receipt-invoices.mjs --apply
```

The migration deletes nothing. Each mislabelled invoice gets a correctly-numbered `INV-`
sibling; the original reverts to the paid receipt it always was and links forward. The `INV-`
counter is seeded from the highest number already in the data, so no number is reused.

---

## Not done, and why

| Item | Reason |
|---|---|
| **A-2** — `ops_shipping` / `orders` widening in `verifyManagerOrderAccess` | Splitting it into read/write variants touches every order route. Real, but lower risk than anything above and worth its own change so the blast radius is reviewable |
| **§3.3** — stale permissions in the 1-day JWT | Same: the unconditional DB re-fetch is a cross-cutting change to `requireAuth`'s contract |
| **Q-2** — image proxy | Correctly left alone. `unoptimized: true` makes it inert today; the audit documented in `next.config.ts` must happen before optimisation is enabled, and `dangerouslyAllowSVG` must go off in the same change |
| **§5.4** — 147 `: any` in API routes | Cleanup, not a defect |
