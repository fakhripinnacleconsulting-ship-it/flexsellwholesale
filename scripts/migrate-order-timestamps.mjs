/**
 * Backfills real instants onto historical order-history entries.
 *
 * Background: history timestamps used to be stored as pre-formatted display strings
 * produced on the server, which runs in UTC:
 *
 *   "Aug 14, 2026, 03:30 PM"    <- en-US display string (5 of the 7 write sites)
 *   "2026-08-14T15:30:00.000Z"  <- ISO (the public order route)
 *
 * Both represent the same instant; only the ISO one says so. This script parses each
 * entry and writes an `at` Date, so every step can be rendered consistently in IST.
 *
 * DRY RUN BY DEFAULT. Nothing is written unless you pass --apply:
 *
 *   node scripts/migrate-order-timestamps.mjs            # report only
 *   node scripts/migrate-order-timestamps.mjs --apply    # write
 *
 * The naive display strings MUST be read as UTC. `new Date("Aug 14, 2026, 03:30 PM")`
 * resolves against the *local* timezone of whatever machine runs it — on an IST laptop
 * that silently shifts every historical timestamp by 5h30m. We pin UTC explicitly.
 */

import mongoose from "mongoose";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const APPLY = process.argv.includes("--apply");

function loadMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const file of [".env.production", ".env.local", ".env"]) {
    try {
      const content = readFileSync(join(root, file), "utf8");
      const match = content.match(/^\s*MONGODB_URI\s*=\s*"?([^"\r\n]+)"?\s*$/m);
      if (match) {
        console.log(`Using MONGODB_URI from ${file}`);
        return match[1];
      }
    } catch {
      // try the next file
    }
  }
  return null;
}

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** True when the string carries its own timezone and is therefore unambiguous. */
function isUnambiguous(value) {
  return typeof value === "string" && HAS_TIMEZONE.test(value.trim());
}

/**
 * Parses a stored timestamp, reading naive strings as UTC.
 *
 * Mirrors toDate() in src/lib/datetime.ts — keep the two in step.
 */
function parseAsUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  if (HAS_TIMEZONE.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const isoLike = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw);
  const pinned = isoLike ? `${raw.replace(" ", "T")}Z` : `${raw} UTC`;
  const d = new Date(pinned);
  if (!Number.isNaN(d.getTime())) return d;

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Works out which timezone a given order's naive display strings were written in.
 *
 * The obvious assumption — "the server runs on Vercel, so they are UTC" — is wrong for
 * part of this data: orders created while running the app locally were rendered in IST.
 * Verified against production: 19 of 24 orders were UTC-written, 5 were IST-written.
 * Blindly pinning everything to UTC would have shifted those 5 forward by 5h30m.
 *
 * The order document carries a real `createdAt` Date (from `timestamps: true`), which is
 * unambiguous. Comparing the oldest history entry against it reveals the offset actually
 * used, per order.
 *
 * Returns the milliseconds to SUBTRACT from a UTC-pinned parse.
 */
function detectOffsetMs(order) {
  if (!order.createdAt) return 0;
  const history = order.history || [];

  // Oldest entry is the "Placed" event, written at (or within seconds of) order creation.
  for (let i = history.length - 1; i >= 0; i--) {
    const ts = history[i]?.timestamp;
    if (!ts || isUnambiguous(ts)) continue;
    const asUtc = parseAsUtc(ts);
    if (!asUtc) continue;

    const created = new Date(order.createdAt).getTime();
    const driftIfUtc = Math.abs(asUtc.getTime() - created);
    const driftIfIst = Math.abs(asUtc.getTime() - IST_OFFSET_MS - created);

    // Whichever reading lands closer to the real creation instant is the right one.
    // A 10-minute tolerance absorbs the seconds lost to minute-precision formatting.
    if (driftIfIst < driftIfUtc && driftIfIst < 10 * 60 * 1000) return IST_OFFSET_MS;
    if (driftIfUtc < 10 * 60 * 1000) return 0;
    return 0;
  }
  return 0;
}

async function main() {
  const uri = loadMongoUri();
  if (!uri) {
    console.error("MONGODB_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(uri, { family: 4, autoIndex: false });
  console.log(`Connected to ${mongoose.connection.name}`);
  console.log(APPLY ? "\n*** APPLY MODE — changes will be written ***\n" : "\n--- DRY RUN — no changes will be written ---\n");

  const orders = mongoose.connection.db.collection("orders");
  const cursor = orders.find(
    { "history.0": { $exists: true } },
    { projection: { history: 1, createdAt: 1 } }
  );

  const stats = {
    orders: 0, ordersNeedingWork: 0, alreadyMigrated: 0,
    parsedIso: 0, parsedDisplayUtc: 0, parsedDisplayIst: 0,
    unparseable: 0, updated: 0,
  };
  const samples = { parsed: [], unparseable: [] };

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    stats.orders++;

    // Per-order: were this order's naive strings written in UTC or in IST?
    const offsetMs = detectOffsetMs(doc);

    let changed = false;
    const history = (doc.history || []).map((event) => {
      if (event.at instanceof Date) {
        stats.alreadyMigrated++;
        return event;
      }

      const utcParse = parseAsUtc(event.timestamp);
      // Unambiguous strings keep their own timezone; naive ones get the detected offset.
      const parsed = utcParse && !isUnambiguous(event.timestamp)
        ? new Date(utcParse.getTime() - offsetMs)
        : utcParse;

      if (!parsed) {
        stats.unparseable++;
        if (samples.unparseable.length < 5) samples.unparseable.push(event.timestamp);
        // Leave the entry untouched — the UI falls back to the raw string, which is
        // honest, rather than inventing a date.
        return event;
      }

      if (isUnambiguous(event.timestamp)) {
        stats.parsedIso++;
      } else if (offsetMs === 0) {
        stats.parsedDisplayUtc++;
      } else {
        stats.parsedDisplayIst++;
      }

      if (samples.parsed.length < 6) {
        const tag = isUnambiguous(event.timestamp) ? "iso" : offsetMs === 0 ? "as-UTC" : "as-IST";
        samples.parsed.push(`[${tag}] ${event.timestamp}  ->  ${parsed.toISOString()}`);
      }

      changed = true;
      return {
        ...event,
        at: parsed,
        // Backfill the customer-safe note from the legacy description so migrated orders
        // render in the customer stepper too. The internal note is deliberately left
        // empty: we cannot reconstruct who acted, and inventing an actor would be worse
        // than showing none.
        customerNote: event.customerNote || event.description,
      };
    });

    if (changed) {
      stats.ordersNeedingWork++;
      if (APPLY) {
        await orders.updateOne({ _id: doc._id }, { $set: { history } });
        stats.updated++;
      }
    }
  }

  console.log("Sample conversions:");
  for (const s of samples.parsed) console.log("  ", s);
  if (samples.unparseable.length) {
    console.log("\nUnparseable (left as-is):");
    for (const s of samples.unparseable) console.log("  ", JSON.stringify(s));
  }

  console.log("\nSummary:");
  console.table([stats]);

  if (!APPLY && stats.ordersNeedingWork > 0) {
    console.log(`\n${stats.ordersNeedingWork} order(s) would be updated. Re-run with --apply to write.`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
