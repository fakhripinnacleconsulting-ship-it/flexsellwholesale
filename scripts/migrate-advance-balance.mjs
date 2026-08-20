/**
 * Backfill for the Wallet → Advance Balance rename.
 *
 *     node scripts/migrate-advance-balance.mjs           # report only, writes nothing
 *     node scripts/migrate-advance-balance.mjs --apply   # perform the updates
 *
 * **Run this only after the renamed application is deployed and verified.** The code accepts
 * both the old and new values, so the app works correctly whether or not this has run — which
 * is what makes it safe to defer, and safe to abandon halfway.
 *
 * It does two things:
 *
 *   1. `Order.paymentMethod`: `"Wallet"` → `"Advance Balance"`
 *   2. `Manager.permissions`: `wallet_store` → `advance_balance_store`, and the business pair
 *
 * It deliberately does **not** rename collections. `wallets`, `wallettransactions` and
 * `walletexpensecategories` keep their names and the models point at them explicitly; a
 * collection name is visible only to someone reading the database directly, and renaming the
 * ledger buys nothing but risk. See docs/advance-balance-rename.md.
 *
 * Idempotent: every update is keyed on the old value, so a second run matches nothing.
 */

import mongoose from "mongoose";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const APPLY = process.argv.includes("--apply");

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Check .env.local.");
  process.exit(1);
}

const PERMISSION_RENAMES = [
  ["wallet_store", "advance_balance_store"],
  ["wallet_business", "advance_balance_business"],
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  console.log(`Connected to ${mongoose.connection.name}`);
  console.log(APPLY ? "\nMode: APPLY — changes will be written\n" : "\nMode: DRY RUN — nothing will be written\n");

  // ─── 1. Orders paid from a balance ───
  const orders = db.collection("orders");
  const orderCount = await orders.countDocuments({ paymentMethod: "Wallet" });
  console.log(`Orders with paymentMethod "Wallet": ${orderCount}`);

  if (APPLY && orderCount > 0) {
    const res = await orders.updateMany(
      { paymentMethod: "Wallet" },
      { $set: { paymentMethod: "Advance Balance" } }
    );
    console.log(`  → updated ${res.modifiedCount}`);
  }

  // ─── 2. Manager permissions ───
  const managers = db.collection("managers");
  for (const [oldId, newId] of PERMISSION_RENAMES) {
    const count = await managers.countDocuments({ permissions: oldId });
    console.log(`Managers holding "${oldId}": ${count}`);

    if (APPLY && count > 0) {
      /**
       * Two steps, not `$set` on a positional match: a manager could already hold the new id
       * (granted after the deploy), and pushing it again would duplicate it. Pull the old,
       * then addToSet the new — which is a no-op if it is already there.
       */
      await managers.updateMany({ permissions: oldId }, { $addToSet: { permissions: newId } });
      const res = await managers.updateMany({ permissions: oldId }, { $pull: { permissions: oldId } });
      console.log(`  → updated ${res.modifiedCount}`);
    }
  }

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply to perform the migration.");
  } else {
    console.log("\nMigration complete.");
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
