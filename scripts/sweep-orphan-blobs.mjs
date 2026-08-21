/**
 * Finds stored files that nothing in the database references any more.
 *
 * Until the storage layer was introduced, the codebase imported `put` and never `del` — no
 * upload was ever deleted, so replacing a customer's PAN card or swapping a category image
 * left the old object in the store forever. Storage could only grow.
 *
 *   node scripts/sweep-orphan-blobs.mjs            # report only — always start here
 *   node scripts/sweep-orphan-blobs.mjs --apply    # deletes the orphans it found
 *
 * **Report-only by default, and deliberately so.** Deleting a blob is the one irreversible
 * step in this whole remediation: a mistake here loses a customer's KYC document with no way
 * back. Read the report, satisfy yourself the references are genuinely gone, and only then
 * apply.
 *
 * Requires BLOB_READ_WRITE_TOKEN and MONGODB_URI.
 */

import mongoose from "mongoose";
import { list, del } from "@vercel/blob";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const APPLY = process.argv.includes("--apply");

/** Objects younger than this are skipped — an in-flight upload has no DB row yet. */
const MIN_AGE_HOURS = 24;

function loadEnv() {
  const wanted = ["MONGODB_URI", "BLOB_READ_WRITE_TOKEN"];
  for (const file of [".env.production", ".env.local", ".env"]) {
    if (wanted.every((k) => process.env[k])) return;
    try {
      const content = readFileSync(join(root, file), "utf8");
      for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]+)"?\s*$/);
        if (match && wanted.includes(match[1]) && !process.env[match[1]]) {
          process.env[match[1]] = match[2];
        }
      }
    } catch {
      // try the next candidate
    }
  }
}

/** Every field in every collection that can hold an upload reference. */
const REFERENCE_SOURCES = [
  { collection: "customers", fields: [
    "kycDocuments.gstCertificate", "kycDocuments.signaturePhoto", "kycDocuments.aadharCard",
    "kycDocuments.passportPhoto", "kycDocuments.panCard", "kycDocuments.chequePhoto",
  ] },
  { collection: "wallettransactions", fields: ["proofUrl"] },
  { collection: "orders", fields: [
    "shipmentDetails.uploadShippingLabel",
    "dropshipDetails.amazonTaxInvoice", "dropshipDetails.amazonPackingSlip",
  ] },
  { collection: "invoices", fields: [
    "dropshipDetails.amazonTaxInvoice", "dropshipDetails.amazonPackingSlip",
  ] },
  { collection: "products", fields: ["colorVariants"] },
  { collection: "categories", fields: ["image"] },
  { collection: "collections", fields: ["image", "bannerImage"] },
  { collection: "cmscontents", fields: ["value"] },
];

/**
 * Harvests every string that could be a stored reference, however deeply nested.
 *
 * CMS content and product variants hold arbitrary nested structures, so this walks values
 * rather than trusting a field list to be complete. A missed reference here would mean
 * deleting a file that is still in use.
 */
function collectStrings(value, sink) {
  if (typeof value === "string") {
    if (value.length > 8) sink.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, sink);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, sink);
  }
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI || !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("MONGODB_URI and BLOB_READ_WRITE_TOKEN are both required. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log(APPLY ? "\n=== APPLYING (deletes orphans) ===\n" : "\n=== REPORT ONLY ===\n");

  const referenced = new Set();
  for (const { collection, fields } of REFERENCE_SOURCES) {
    const projection = Object.fromEntries(fields.map((f) => [f, 1]));
    const docs = await db.collection(collection).find({}, { projection }).toArray();
    for (const doc of docs) collectStrings(doc, referenced);
  }
  console.log(`Collected ${referenced.size} referenced string(s) from the database.`);

  const cutoff = Date.now() - MIN_AGE_HOURS * 60 * 60 * 1000;

  let cursor;
  let scanned = 0;
  let orphanBytes = 0;
  const orphans = [];

  do {
    const page = await list({ token: process.env.BLOB_READ_WRITE_TOKEN, cursor, limit: 1000 });
    for (const blob of page.blobs) {
      scanned += 1;

      if (new Date(blob.uploadedAt).getTime() > cutoff) continue;

      // Referenced by URL (public assets) or by pathname (private documents), and legacy
      // proxy rows embed the URL in a query string — a substring test covers all three.
      const isReferenced = [...referenced].some(
        (ref) => ref.includes(blob.pathname) || ref.includes(blob.url)
      );

      if (!isReferenced) {
        orphans.push(blob);
        orphanBytes += blob.size || 0;
      }
    }
    cursor = page.cursor;
  } while (cursor);

  console.log(`Scanned ${scanned} stored object(s).`);
  console.log(`Found ${orphans.length} orphan(s), ${(orphanBytes / (1024 * 1024)).toFixed(1)} MB.\n`);

  for (const blob of orphans.slice(0, 50)) {
    console.log(`  ${((blob.size || 0) / 1024).toFixed(0).padStart(7)} KB  ${blob.uploadedAt}  ${blob.pathname}`);
  }
  if (orphans.length > 50) console.log(`  … and ${orphans.length - 50} more`);

  if (APPLY && orphans.length > 0) {
    console.log("\nDeleting…");
    // Batched: `del` accepts an array, and one call per object would be thousands of requests.
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100).map((b) => b.url);
      await del(batch, { token: process.env.BLOB_READ_WRITE_TOKEN });
      console.log(`  deleted ${Math.min(i + 100, orphans.length)}/${orphans.length}`);
    }
    console.log(`\nReclaimed ${(orphanBytes / (1024 * 1024)).toFixed(1)} MB.`);
  } else if (orphans.length > 0) {
    console.log("\nReport only. Re-run with --apply to delete these — this cannot be undone.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Sweep failed:", err);
  process.exit(1);
});
