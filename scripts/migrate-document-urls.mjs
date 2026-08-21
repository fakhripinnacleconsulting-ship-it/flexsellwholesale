/**
 * Rewrites stored proxy URLs down to direct references.
 *
 * Uploads used to store `/api/customers/document/<name>?url=<blobUrl>` in Mongo. Every view
 * of such a document was therefore served by a serverless function that fetched the blob and
 * re-streamed it — billed egress twice, never cached by the CDN. 255 MB of stored files were
 * producing 10 GB of transfer.
 *
 * This turns each of those into the bare `<blobUrl>`, which the CDN serves directly.
 *
 *   node scripts/migrate-document-urls.mjs             # dry run, writes nothing
 *   node scripts/migrate-document-urls.mjs --apply     # performs the rewrite
 *   node scripts/migrate-document-urls.mjs --rollback  # restores from the backup field
 *
 * Every rewritten document keeps its previous value under `_migrationBackup.documentUrls`,
 * so --rollback is exact rather than reconstructed.
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
const ROLLBACK = process.argv.includes("--rollback");

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
      // try the next candidate
    }
  }
}

/** Every place an upload URL is persisted. Missing one leaves a document proxied forever. */
const TARGETS = [
  { collection: "customers", fields: [
    "kycDocuments.gstCertificate",
    "kycDocuments.signaturePhoto",
    "kycDocuments.aadharCard",
    "kycDocuments.passportPhoto",
    "kycDocuments.panCard",
    "kycDocuments.chequePhoto",
  ] },
  { collection: "wallettransactions", fields: ["proofUrl"] },
  { collection: "orders", fields: [
    "shipmentDetails.uploadShippingLabel",
    "dropshipDetails.amazonTaxInvoice",
    "dropshipDetails.amazonPackingSlip",
  ] },
  { collection: "invoices", fields: [
    "dropshipDetails.amazonTaxInvoice",
    "dropshipDetails.amazonPackingSlip",
  ] },
];

const PROXY_MARKER = "/api/customers/document/";

/** Pulls the real blob URL out of the proxy path's query string. */
function directUrlFrom(value) {
  if (typeof value !== "string" || !value.includes(PROXY_MARKER)) return null;
  const queryIndex = value.indexOf("?");
  if (queryIndex === -1) return null;
  try {
    const url = new URLSearchParams(value.slice(queryIndex + 1)).get("url");
    return url && url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}

function readPath(doc, path) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), doc);
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(
    ROLLBACK ? "\n=== ROLLBACK ===\n" : APPLY ? "\n=== APPLYING ===\n" : "\n=== DRY RUN (no writes) ===\n"
  );

  let total = 0;

  for (const { collection, fields } of TARGETS) {
    const col = db.collection(collection);

    if (ROLLBACK) {
      const backed = await col.find({ "_migrationBackup.documentUrls": { $exists: true } }).toArray();
      for (const doc of backed) {
        const restore = doc._migrationBackup.documentUrls;
        if (APPLY) {
          await col.updateOne(
            { _id: doc._id },
            { $set: restore, $unset: { "_migrationBackup.documentUrls": "" } }
          );
        }
        console.log(`  RESTORE  ${collection}/${doc._id} (${Object.keys(restore).length} field(s))`);
        total += 1;
      }
      continue;
    }

    // Only documents that actually hold a proxy URL in one of the target fields.
    const query = { $or: fields.map((field) => ({ [field]: { $regex: PROXY_MARKER } })) };
    const docs = await col.find(query).toArray();

    for (const doc of docs) {
      const updates = {};
      const backup = {};

      for (const field of fields) {
        const current = readPath(doc, field);
        const direct = directUrlFrom(current);
        if (direct) {
          updates[field] = direct;
          backup[field] = current;
        }
      }

      if (Object.keys(updates).length === 0) continue;

      console.log(`  REWRITE  ${collection}/${doc._id}`);
      for (const [field, value] of Object.entries(updates)) {
        console.log(`             ${field}\n               -> ${value.slice(0, 90)}…`);
      }

      if (APPLY) {
        await col.updateOne(
          { _id: doc._id },
          { $set: { ...updates, "_migrationBackup.documentUrls": backup } }
        );
      }

      total += 1;
    }
  }

  if (total === 0) {
    console.log("Nothing to do — no proxy URLs found.");
  } else {
    console.log(
      `\n${APPLY ? (ROLLBACK ? "Restored" : "Rewrote") : "Would rewrite"} ${total} document(s).`
    );
    if (!APPLY) console.log("Re-run with --apply to perform the change.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
