# Wallet → Advance Balance: rename & migration plan

> An earlier global find-and-replace over this repository rewrote the word `Wallet` inside this
> file, turning the old identifiers it documents into `Advance` and making the whole thing
> describe a migration that does not exist. It has been rewritten. **Do not run a blanket
> replace across this file** — its entire purpose is to record the *old* names, so every one of
> them must survive verbatim.

**Agreed wording:** `Store Advance Balance` / `Business Advance Balance`; the combined figure is
`Advance Balance`.

---

## The four things that are not just a find-and-replace

Everything else in this rename is text or code identifiers and carries no risk. These four are
**values that already exist outside this codebase** — in the database, or in Razorpay's records —
and renaming them without care destroys access to money or breaks live payments.

### 1. MongoDB collection names — **not renamed, deliberately**

```
mongoose.model("Wallet", …)                 → collection `wallets`
mongoose.model("WalletTransaction", …)      → collection `wallettransactions`
mongoose.model("WalletExpenseCategory", …)  → collection `walletexpensecategories`
```

Mongoose derives the collection from the model name. Renaming the model to `AdvanceBalance`
silently points the app at an empty `advancebalances` collection: **every customer balance and
the entire append-only ledger become invisible**, while the app happily reports ₹0 and lets
people top up into a new, parallel set of records.

So the models keep their storage. Where a model is renamed in code, the collection is pinned
explicitly to its existing name:

```ts
mongoose.model("AdvanceBalance", AdvanceBalanceSchema, "wallets")
```

A collection name is visible only to someone reading the database directly, so renaming it buys
cosmetic consistency in exchange for real risk to the ledger. The rename is available at the
bottom of this file if it is ever genuinely wanted.

### 2. `Order.paymentMethod` — the value `"Wallet"` is on every balance-paid order

```ts
enum: ["Bank Transfer", "Razorpay", "UPI", "COD", "Advance Balance", "Wallet", "Cash"]
```

Dropping `"Wallet"` would make every historical order fail validation the next time it is saved —
which happens on any status change, shipment or settlement.

**Done:** the enum accepts both. `"Advance Balance"` is written on new orders; `"Wallet"` stays
accepted so existing ones keep saving. The backfill converts old rows when convenient, and
nothing breaks if it never runs.

### 3. Manager permissions — `wallet_store` / `wallet_business`

These strings live in each manager's `permissions` array in the database. Renaming them in code
alone would revoke **every manager's access the moment it deployed**, with no error explaining
why — a permission check does not fail loudly, it simply stops matching.

**Done:** `permissionsForWallet()` returns the new id *and* the legacy one, and the guard accepts
either. The UI checks both too, so the spend controls are not hidden from a manager the server
would in fact allow. Deploy this first; run the backfill after.

### 4. `flexsellWalletTxnId` — this key lives in Razorpay's records, not ours

```ts
// written when a top-up starts
notes: { flexsellAdvanceBalanceTxnId: …, flexsellWalletTxnId: … }
// read when the webhook arrives
const pendingTopUpId = notes.flexsellAdvanceBalanceTxnId || notes.flexsellWalletTxnId;
```

The note is attached to a Razorpay order when a top-up begins and comes back minutes later on the
webhook. Any top-up started before the deploy carries the **old** key. If the webhook only looked
for the new one, those payments would be captured by Razorpay and never credited — the customer
debited, the balance unmoved.

**Done:** the webhook reads both keys and `initiate` writes both. The read fallback is permanent,
not a transitional shim: a retried webhook can deliver an old note at any point in the future.
The *written* legacy pair can be dropped once no old instance is serving traffic.

---

## What has been renamed

| Area | From | To |
|---|---|---|
| API routes | `/api/wallet/*` | `/api/advance-balance/*` |
| Customer page | `/client/wallet` | `/client/advance-balance` |
| Admin page | `/admin/wallets` | `/admin/advance-balance` |
| Vercel cron | `/api/wallet/maintenance` | `/api/advance-balance/maintenance` |
| Libraries | `walletLedger`, `walletGuard`, `walletCheckout`, `walletRecharge`, `walletMaintenance`, `walletConstants` | `advanceBalance*` |
| Service | `services/walletService.ts` | `services/advanceBalanceService.ts` |
| Types | `types/wallet.ts` | `types/advanceBalance.ts` |
| UI text | "Store/Business Wallet", "Wallet Balance", "My Wallets" | "Store/Business Advance Balance", "Advance Balance", "My Advance Balance" |

**The Vercel cron path matters.** It is configuration, not code — nothing type-checks it, and a
stale path fails silently: the daily maintenance sweep simply stops running and nothing reports
it. It is updated in `vercel.json` in the same commit as the route move.

## Backfill script

`scripts/migrate-advance-balance.mjs`. Idempotent — every update is keyed on the old value, so a
second run matches nothing.

```bash
node scripts/migrate-advance-balance.mjs           # report only, writes nothing
node scripts/migrate-advance-balance.mjs --apply   # perform the updates
```

- `Order.paymentMethod`: `"Wallet"` → `"Advance Balance"`
- `Manager.permissions`: `wallet_store` → `advance_balance_store`, `wallet_business` →
  `advance_balance_business`

Run it **after** the renamed application is deployed and verified. The code accepts both old and
new values, which is what makes it safe to defer and safe to abandon halfway.

## Optional: renaming the collections

Not recommended, and not part of this work. If it is ever wanted, it is a deliberate operation
against a **stopped** application with a fresh backup, and the pinned collection names in the
models must change in the same deploy:

```js
db.wallets.renameCollection("advancebalances")
db.wallettransactions.renameCollection("advancebalancetransactions")
db.walletexpensecategories.renameCollection("advancebalanceexpensecategories")
```
