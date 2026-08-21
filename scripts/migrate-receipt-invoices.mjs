/**
 * Repairs Tax Invoices that carry a receipt number.
 *
 * The old settlement path converted a paid receipt by flipping `type` on the existing
 * document. `Invoice._id` is an assigned String and MongoDB will not change an `_id`, so
 * every invoice produced that way kept its `REC-` number and the `INV-` counter never
 * advanced. GST Rule 46(b) requires a consecutive serial unique to the invoice series, so
 * those documents are not validly numbered.
 *
 * This script, for each `type: "invoice"` document whose `_id` is not in the `INV-` series:
 *
 *   1. Issues a correctly-numbered `INV-` document carrying the same content.
 *   2. Restores the original to a paid `receipt`, linked forward via `settledByInvoiceId`.
 *   3. Repoints the linked order's `invoiceId` at the new invoice.
 *
 * Nothing is deleted — the original stays as the receipt it always was, which is also the
 * audit record of what was collected.
 *
 *   node scripts/migrate-receipt-invoices.mjs            # dry run, writes nothing
 *   node scripts/migrate-receipt-invoices.mjs --apply    # performs the migration
 *
 * Run `node scripts/sync-indexes.mjs` FIRST so the unique index on `sourceReceiptId` exists;
 * that index is what stops a re-run from double-issuing.
 *
 * Reads MONGODB_URI from the environment (.env.production for the live cluster).
 */

import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const APPLY = process.argv.includes("--apply");

function loadEnv() {
  if (process.env.MONGODB_URI) return;
  for (const file of [".env.production", ".env.local", ".env"]) {
    try {
      const content = readFileSync(join(root, file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*MONGODB_URI\s*=\s*"?([^"\r\n]+)"?\s*$/);
        if (match) {
          process.env.MONGODB_URI = match[1];
          console.log(`Using MONGODB_URI from ${file}`);
          return;
        }
      }
    } catch {
      // file absent — try the next one
    }
  }
}

/** Zero-padded `INV-` id, matching lib/idGenerator's default format for the invoice series. */
function formatInvoiceId(seq) {
  return `INV-${String(seq).padStart(5, "0")}`;
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const invoices = db.collection("invoices");
  const orders = db.collection("orders");
  const counters = db.collection("counters");

  console.log(APPLY ? "\n=== APPLYING ===\n" : "\n=== DRY RUN (no writes) ===\n");

  const mislabelled = await invoices
    .find({ type: "invoice", _id: { $not: /^INV-/ } })
    .sort({ createdAt: 1 })
    .toArray();

  if (mislabelled.length === 0) {
    console.log("No invoices found outside the INV- series. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${mislabelled.length} invoice(s) numbered outside the INV- series.\n`);

  /**
   * Seed the counter above the highest INV- already issued.
   *
   * Reusing a number that is already in the wild would be worse than the bug being fixed, so
   * the starting point is derived from the data rather than assumed.
   */
  const highest = await invoices
    .find({ _id: /^INV-\d+$/ })
    .sort({ _id: -1 })
    .limit(1)
    .toArray();

  let seq = highest.length > 0 ? parseInt(String(highest[0]._id).replace("INV-", ""), 10) : 1000;
  const counterDoc = await counters.findOne({ _id: "counter_invoice" });
  if (counterDoc && counterDoc.seq > seq) seq = counterDoc.seq;

  console.log(`Next INV- number will start from ${formatInvoiceId(seq + 1)}.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const doc of mislabelled) {
    const existing = await invoices.findOne({ sourceReceiptId: doc._id });
    if (existing) {
      console.log(`  SKIP  ${doc._id} — already migrated to ${existing._id}`);
      skipped += 1;
      continue;
    }

    seq += 1;
    const newId = formatInvoiceId(seq);

    console.log(
      `  MOVE  ${doc._id} -> ${newId}` +
        `  (${doc.customerName || "unknown"}, ${doc.amount ?? "?"}` +
        `${doc.orderId ? `, order ${doc.orderId}` : ""})`
    );

    if (!APPLY) {
      migrated += 1;
      continue;
    }

    const { _id, ...content } = doc;

    await invoices.insertOne({
      ...content,
      _id: newId,
      type: "invoice",
      status: "paid",
      paymentStatus: "Paid",
      sourceReceiptId: _id,
      settledByInvoiceId: undefined,
      issuedAt: content.issuedAt || content.createdAt || new Date(),
    });

    // The original becomes the receipt it always was, pointing forward at the new invoice.
    await invoices.updateOne(
      { _id },
      {
        $set: {
          type: "receipt",
          status: "paid",
          paymentStatus: "Paid",
          settledByInvoiceId: newId,
        },
        $unset: { sourceReceiptId: "" },
      }
    );

    if (content.orderId) {
      await orders.updateOne({ _id: content.orderId }, { $set: { invoiceId: newId } });
    }

    migrated += 1;
  }

  if (APPLY) {
    await counters.updateOne({ _id: "counter_invoice" }, { $set: { seq } }, { upsert: true });
    console.log(`\nCounter 'counter_invoice' set to ${seq}.`);
  }

  console.log(
    `\n${APPLY ? "Migrated" : "Would migrate"} ${migrated} invoice(s); skipped ${skipped}.`
  );
  if (!APPLY) console.log("Re-run with --apply to perform the migration.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
