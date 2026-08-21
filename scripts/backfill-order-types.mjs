/**
 * Fills in missing `orderType`, and reports every access change it would cause.
 *
 * The customer dashboard used to decide which tab an order belonged in by inspecting
 * line-item price tiers, with a fallback that claimed **any non-B2B COD order as
 * Dropshipping**. Filtering now reads `Order.orderType`, so orders written before that field
 * existed — or written with it missing — need a value.
 *
 *   node scripts/backfill-order-types.mjs             # dry run + access diff
 *   node scripts/backfill-order-types.mjs --apply     # performs the backfill
 *   node scripts/backfill-order-types.mjs --rollback  # restores from the backup field
 *
 * ⚠️  **Read the access diff before applying.** Manager RBAC scopes by `orderType`
 * (/api/orders), so giving an order a type can make it appear for one manager and disappear
 * for another. That is a permissions change, not a display change, and it is printed
 * explicitly rather than being left for someone to discover.
 *
 * Only orders with a **missing** type are assigned. An order that already carries one is
 * never rewritten — a stored value was a decision someone made, and this script is not
 * better informed than they were.
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

/**
 * The same precedence the create route now uses.
 *
 * Deliberately does **not** look at line-item price tiers. That inference is the bug being
 * fixed; reproducing it here would bake it into the data permanently.
 */
function resolveOrderType(order, customerTypes) {
  if (order.quoteCustomerType) return order.quoteCustomerType;
  if (customerTypes.length === 1) return customerTypes[0];
  if (order.shippingAddress?.company || order.shippingAddress?.gstin) return "B2B";
  if (customerTypes.includes("B2B")) return "B2B";
  if (customerTypes.includes("Dropshipping")) return "Dropshipping";
  return "B2C";
}

const PERM_FOR_TYPE = {
  B2B: "orders_b2b",
  B2C: "orders_b2c",
  Dropshipping: "orders_dropshipping",
};

function managerCanSee(perms, orderType) {
  if (perms.includes("orders") || perms.includes("ops_shipping")) return true;
  const required = PERM_FOR_TYPE[orderType];
  return perms.some((p) => p === required || p.startsWith(`${required}:`));
}

async function main() {
  loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const orders = db.collection("orders");
  const customers = db.collection("customers");
  const managers = db.collection("managers");

  console.log(
    ROLLBACK ? "\n=== ROLLBACK ===\n" : APPLY ? "\n=== APPLYING ===\n" : "\n=== DRY RUN (no writes) ===\n"
  );

  if (ROLLBACK) {
    const backed = await orders.find({ "_migrationBackup.orderType": { $exists: true } }).toArray();
    for (const order of backed) {
      const previous = order._migrationBackup.orderType;
      if (APPLY) {
        await orders.updateOne(
          { _id: order._id },
          previous === null
            ? { $unset: { orderType: "", "_migrationBackup.orderType": "" } }
            : { $set: { orderType: previous }, $unset: { "_migrationBackup.orderType": "" } }
        );
      }
      console.log(`  RESTORE  ${order._id} -> ${previous ?? "(unset)"}`);
    }
    console.log(`\n${APPLY ? "Restored" : "Would restore"} ${backed.length} order(s).`);
    await mongoose.disconnect();
    return;
  }

  const untyped = await orders
    .find({ $or: [{ orderType: { $exists: false } }, { orderType: null }, { orderType: "" }] })
    .toArray();

  if (untyped.length === 0) {
    console.log("Every order already carries an orderType. Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${untyped.length} order(s) with no orderType.\n`);

  const activeManagers = await managers
    .find({ status: "active" })
    .project({ name: 1, permissions: 1 })
    .toArray();

  // Before the backfill an untyped order is treated as B2B by the API's legacy convention,
  // so that is the baseline every "after" is compared against.
  const accessDelta = new Map(activeManagers.map((m) => [String(m._id), { name: m.name, gains: 0, loses: 0 }]));

  const assignments = [];

  for (const order of untyped) {
    const email = order.shippingAddress?.email?.toLowerCase();
    const customer = email ? await customers.findOne({ email }, { projection: { customerTypes: 1 } }) : null;
    const customerTypes = customer?.customerTypes?.length ? customer.customerTypes : ["B2C"];

    const resolved = resolveOrderType(order, customerTypes);
    assignments.push({ id: order._id, resolved, customerTypes });

    for (const manager of activeManagers) {
      const perms = manager.permissions || [];
      const before = managerCanSee(perms, "B2B");
      const after = managerCanSee(perms, resolved);
      const entry = accessDelta.get(String(manager._id));
      if (!before && after) entry.gains += 1;
      if (before && !after) entry.loses += 1;
    }
  }

  const byType = assignments.reduce((acc, a) => {
    acc[a.resolved] = (acc[a.resolved] || 0) + 1;
    return acc;
  }, {});

  console.log("Assignments:");
  for (const [type, count] of Object.entries(byType)) {
    console.log(`  ${type.padEnd(14)} ${count}`);
  }

  console.log("\n⚠️  MANAGER ACCESS DIFF (baseline: untyped orders are currently treated as B2B)");
  let anyChange = false;
  for (const { name, gains, loses } of accessDelta.values()) {
    if (gains === 0 && loses === 0) continue;
    anyChange = true;
    console.log(`  ${name}: +${gains} newly visible, -${loses} no longer visible`);
  }
  if (!anyChange) console.log("  No manager's visibility changes.");

  console.log("\nFirst 20 assignments:");
  for (const a of assignments.slice(0, 20)) {
    console.log(`  ${String(a.id).padEnd(16)} -> ${a.resolved.padEnd(14)} (account: ${a.customerTypes.join("/")})`);
  }

  if (APPLY) {
    for (const a of assignments) {
      await orders.updateOne(
        { _id: a.id },
        { $set: { orderType: a.resolved, "_migrationBackup.orderType": null } }
      );
    }
    console.log(`\nApplied to ${assignments.length} order(s).`);
  } else {
    console.log("\nReview the access diff above, then re-run with --apply.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
