/**
 * One-off reconciliation for orders stranded by the old "pay first, create order after" flow.
 *
 * Under that flow the checkout never told /api/razorpay/verify which order it was settling, so
 * captured payments left their orders sitting at paymentStatus "Pending" with no razorpayOrderId
 * to match on. This script pairs those orders with captured Razorpay payments by amount +
 * contact details within a time window, and settles the ones it can match unambiguously.
 *
 * Run this BEFORE letting the hourly abandoned-order reaper loose, otherwise it will cancel
 * orders that were genuinely paid for.
 *
 *   node scripts/reconcile-razorpay-payments.mjs            # dry run, prints what it would do
 *   node scripts/reconcile-razorpay-payments.mjs --apply    # actually settles matched orders
 *   node scripts/reconcile-razorpay-payments.mjs --days=90  # widen the search window
 */

import mongoose from "mongoose";
import Razorpay from "razorpay";

const APPLY = process.argv.includes("--apply");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const DAYS = daysArg ? Number(daysArg.split("=")[1]) : 60;

// How far apart an order and its payment may be and still be considered the same transaction.
const MATCH_WINDOW_MINUTES = 60;

function paise(rupees) {
  return Math.round(Number(rupees) * 100);
}

function normalisePhone(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

async function main() {
  const { MONGODB_URI, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");

  await mongoose.connect(MONGODB_URI);
  const orders = mongoose.connection.collection("orders");

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

  const stranded = await orders
    .find({
      paymentMethod: "Razorpay",
      paymentStatus: { $ne: "Paid" },
      status: { $ne: "Cancelled" },
      createdAt: { $gte: since },
    })
    .toArray();

  console.log(`Found ${stranded.length} unpaid Razorpay orders created in the last ${DAYS} days.\n`);

  if (stranded.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

  // Pull captured payments across the same window. Razorpay caps `count` at 100 per page.
  const captured = [];
  const from = Math.floor(since.getTime() / 1000);
  const to = Math.floor(Date.now() / 1000);
  let skip = 0;

  for (;;) {
    const page = await razorpay.payments.all({ from, to, count: 100, skip });
    const items = page.items || [];
    captured.push(...items.filter((p) => p.status === "captured"));
    if (items.length < 100) break;
    skip += 100;
  }

  console.log(`Fetched ${captured.length} captured Razorpay payments in the same window.\n`);

  // A payment already stamped on some order must not be reused for another.
  const alreadyUsed = new Set(
    (await orders.find({ transactionId: { $ne: null } }).project({ transactionId: 1 }).toArray())
      .map((o) => o.transactionId)
      .filter(Boolean)
  );

  const results = { settled: [], ambiguous: [], unmatched: [] };

  for (const order of stranded) {
    const orderTime = new Date(order.createdAt).getTime();
    const wanted = paise(order.amount);
    const email = String(order.shippingAddress?.email || "").toLowerCase();
    const phone = normalisePhone(order.shippingAddress?.phone);

    const candidates = captured.filter((p) => {
      if (alreadyUsed.has(p.id)) return false;
      if (p.amount !== wanted) return false;

      const paidTime = p.created_at * 1000;
      if (Math.abs(paidTime - orderTime) > MATCH_WINDOW_MINUTES * 60 * 1000) return false;

      // Contact match is what keeps two same-priced orders from being confused.
      const pEmail = String(p.email || "").toLowerCase();
      const pPhone = normalisePhone(p.contact);
      return (email && pEmail === email) || (phone && pPhone === phone);
    });

    if (candidates.length === 0) {
      results.unmatched.push({ orderId: order._id, amount: order.amount, email, createdAt: order.createdAt });
      continue;
    }

    if (candidates.length > 1) {
      results.ambiguous.push({
        orderId: order._id,
        amount: order.amount,
        email,
        paymentIds: candidates.map((c) => c.id),
      });
      continue;
    }

    const payment = candidates[0];
    alreadyUsed.add(payment.id);
    results.settled.push({ orderId: order._id, amount: order.amount, email, paymentId: payment.id });

    if (APPLY) {
      await orders.updateOne(
        { _id: order._id, paymentStatus: { $ne: "Paid" } },
        {
          $set: {
            paymentStatus: "Paid",
            transactionId: payment.id,
            razorpayOrderId: payment.order_id || "",
          },
          $push: {
            history: {
              $each: [
                {
                  status: "Payment Verified",
                  timestamp: new Date().toLocaleString("en-US", {
                    month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                  }),
                  description: `Payment reconciled offline against Razorpay payment ${payment.id}.`,
                },
              ],
              $position: 0,
            },
          },
        }
      );
    }
  }

  console.log(`Matched and ${APPLY ? "settled" : "would settle"}: ${results.settled.length}`);
  for (const r of results.settled) console.log(`  ${r.orderId}  ₹${r.amount}  ${r.email}  -> ${r.paymentId}`);

  console.log(`\nAmbiguous (needs a human): ${results.ambiguous.length}`);
  for (const r of results.ambiguous) console.log(`  ${r.orderId}  ₹${r.amount}  ${r.email}  -> ${r.paymentIds.join(", ")}`);

  console.log(`\nNo captured payment found (genuinely abandoned): ${results.unmatched.length}`);
  for (const r of results.unmatched) console.log(`  ${r.orderId}  ₹${r.amount}  ${r.email}  ${r.createdAt}`);

  if (!APPLY) {
    console.log("\nDry run — nothing was written. Re-run with --apply to settle the matched orders.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
