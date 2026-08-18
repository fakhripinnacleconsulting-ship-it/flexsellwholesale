/**
 * Pre-flight check before `sync-indexes.mjs` — read-only, writes nothing, ever.
 *
 * Why this exists: `dbConnect` sets `autoIndex: false` in production, so indexes only appear
 * when `sync-indexes.mjs` is run out of band. If the wallet has been live without that ever
 * happening, its **unique** indexes were never enforcing anything — and the ledger's
 * idempotency is those indexes, not an application-level check:
 *
 *   - `walletTransactions.paymentId`      a replayed Razorpay webhook credits twice
 *   - `walletTransactions.clientRequestId` a double-clicked form debits twice
 *   - `walletTransactions.receiptNumber`   two entries can share a receipt number
 *   - `wallets.{userId, type}`             one customer ends up with two Store Wallets
 *   - `invoices.sourceReceiptId`           one receipt settles into two invoices
 *
 * `createIndex` with `unique: true` **fails outright if duplicates already exist**. So run
 * this first: it reports which unique indexes are missing and whether the data would block
 * them, and it prints the offending documents rather than leaving you to find them.
 *
 *   node scripts/check-index-readiness.mjs
 *
 * A clean report means `sync-indexes.mjs` will succeed. Duplicates must be resolved by hand —
 * deliberately, because deciding which of two conflicting money records is real is a judgement
 * call, not something a script should make on your behalf.
 */

import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  if (process.env.MONGODB_URI) return;
  for (const file of [".env.production", ".env.local", ".env"]) {
    try {
      const content = readFileSync(join(root, file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*MONGODB_URI\s*=\s*"?([^"\r\n]+)"?\s*$/);
        if (match) {
          process.env.MONGODB_URI = match[1];
          console.log(`Using MONGODB_URI from ${file}\n`);
          return;
        }
      }
    } catch {
      // try the next candidate
    }
  }
}

/**
 * The unique indexes whose absence has real consequences, with the field(s) they cover and
 * what goes wrong without them. Sparse ones ignore documents where the field is absent.
 */
const UNIQUE_INDEXES = [
  {
    collection: "wallettransactions",
    fields: ["paymentId"],
    sparse: true,
    risk: "A replayed Razorpay webhook credits the wallet a second time.",
  },
  {
    collection: "wallettransactions",
    fields: ["clientRequestId"],
    sparse: true,
    risk: "A double-clicked form debits or credits twice.",
  },
  {
    collection: "wallettransactions",
    fields: ["receiptNumber"],
    sparse: false,
    risk: "Two ledger entries share one receipt number; the statement cannot be reconciled.",
  },
  {
    collection: "wallets",
    fields: ["userId", "type"],
    sparse: false,
    risk: "A customer ends up with two wallets of the same type and a balance split across them.",
  },
  {
    collection: "invoices",
    fields: ["sourceReceiptId"],
    sparse: true,
    risk: "One receipt settles into two tax invoices.",
  },
];

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log("=== INDEX READINESS (read-only) ===\n");

  let blocking = 0;
  let missing = 0;

  for (const spec of UNIQUE_INDEXES) {
    const label = `${spec.collection}.{${spec.fields.join(", ")}}`;

    const collections = await db.listCollections({ name: spec.collection }).toArray();
    if (collections.length === 0) {
      console.log(`  —  ${label.padEnd(46)} collection does not exist yet — nothing to check`);
      continue;
    }

    const col = db.collection(spec.collection);

    // Does an index already cover exactly these fields?
    const existing = await col.indexes();
    const present = existing.some((idx) => {
      const keys = Object.keys(idx.key || {});
      return (
        idx.unique === true &&
        keys.length === spec.fields.length &&
        keys.every((k, i) => k === spec.fields[i])
      );
    });

    // Group by the indexed field(s) and keep anything appearing more than once. Sparse
    // indexes ignore missing values, so those documents are excluded from the check the
    // same way the index would exclude them.
    const groupId = Object.fromEntries(spec.fields.map((f) => [f, `$${f}`]));
    const match = spec.sparse
      ? { $match: Object.fromEntries(spec.fields.map((f) => [f, { $nin: [null, ""] }])) }
      : { $match: {} };

    const duplicates = await col
      .aggregate([
        match,
        { $group: { _id: groupId, count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 25 },
      ])
      .toArray();

    if (duplicates.length > 0) {
      blocking += 1;
      console.log(`  ✗  ${label.padEnd(46)} ${duplicates.length} DUPLICATE GROUP(S) — index cannot be created`);
      console.log(`     risk while absent: ${spec.risk}`);
      for (const dup of duplicates.slice(0, 5)) {
        const value = spec.fields.map((f) => dup._id[f]).join(" / ");
        console.log(`       "${value}" — ${dup.count}× : ${dup.ids.slice(0, 4).join(", ")}`);
      }
      if (duplicates.length > 5) console.log(`       … and ${duplicates.length - 5} more group(s)`);
      console.log("");
    } else if (present) {
      console.log(`  ✓  ${label.padEnd(46)} already enforced`);
    } else {
      missing += 1;
      console.log(`  !  ${label.padEnd(46)} MISSING, but the data is clean — safe to create`);
      console.log(`     risk while absent: ${spec.risk}\n`);
    }
  }

  console.log("\n=== SUMMARY ===\n");

  if (blocking > 0) {
    console.log(`  ${blocking} unique index(es) are blocked by existing duplicate data.`);
    console.log("  Resolve those documents by hand before running sync-indexes.mjs — deciding");
    console.log("  which of two conflicting money records is real is not a script's call.\n");
    console.log("  For a duplicated clientRequestId or paymentId, the usual answer is that one");
    console.log("  entry is a genuine double-charge: reverse it through the admin reversal flow");
    console.log("  (never delete it — the ledger is append-only) and re-run this check.");
  } else if (missing > 0) {
    console.log(`  ${missing} unique index(es) are missing and the data is clean.`);
    console.log("  Run:  node scripts/sync-indexes.mjs");
  } else {
    console.log("  Every unique index is present. Nothing to do.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Readiness check failed:", err);
  process.exit(1);
});
