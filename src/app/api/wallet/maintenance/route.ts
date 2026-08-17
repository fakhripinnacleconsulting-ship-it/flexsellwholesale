import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  settleStuckRecharges,
  releaseExpiredHolds,
  reconcileWallets,
} from "@/lib/walletMaintenance";
import { formatPaise } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * The wallet's single daily maintenance pass.
 *
 * All three jobs run in **one invocation** rather than one cron each, because Vercel's
 * Hobby plan allows only two cron jobs in total and `/api/orders/reap-abandoned` already
 * uses one. Three separate schedules would not fit, and even where they would, three
 * invocations to scan the same small collections is waste.
 *
 * This is the backstop, not the primary path: stuck recharges are also settled lazily when
 * a customer opens their wallet, so nobody waits a day for money they have already paid.
 *
 * Protected by CRON_SECRET rather than a session, since no user is present when it runs.
 */
async function runMaintenance(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await dbConnect();

  const started = Date.now();

  // Sequential, not parallel: releasing a hold and settling a recharge can touch the same
  // wallet, and running them concurrently would make the reconciliation that follows race
  // against its own inputs.
  const recharges = await settleStuckRecharges({ limit: 200 });
  const holds = await releaseExpiredHolds();
  const drift = await reconcileWallets();

  if (drift.length > 0) {
    // Loud on purpose. Drift means the ledger and the balance disagree, which no customer
    // can detect from the UI — they simply see a number that is wrong. Nothing here
    // "corrects" it: an automatic fix would hide the bug that caused it.
    console.error(
      `[Wallet Reconciliation] DRIFT DETECTED on ${drift.length} wallet(s):\n` +
        drift
          .map(
            (d) =>
              `  ${d.walletType} wallet ${d.walletId} (customer ${d.userId}): ` +
              `ledger ${formatPaise(d.ledgerBalance)}, recorded ${formatPaise(d.recordedBalance)}, ` +
              `difference ${formatPaise(d.difference)}`
          )
          .join("\n")
    );

    try {
      const { dispatchEventServer } = await import("@/lib/events/eventDispatcherServer");
      dispatchEventServer({
        eventType: "SECURITY_ALERT",
        category: "security",
        actor: { id: "SYSTEM", name: "Wallet Reconciliation", role: "system" },
        recipient: { role: "admin" },
        entity: { type: "wallet", id: "reconciliation" },
        data: { driftCount: drift.length, wallets: drift },
      });
    } catch (err) {
      console.error("[Wallet Reconciliation] Failed to raise drift alert:", err);
    }
  }

  const summary = {
    durationMs: Date.now() - started,
    recharges,
    holdsReleased: holds.released,
    holdsReleasedAmount: holds.amount,
    driftCount: drift.length,
  };

  if (recharges.credited > 0 || holds.released > 0 || drift.length > 0 || recharges.errors > 0) {
    console.warn(`[Wallet Maintenance] ${JSON.stringify(summary)}`);
  }

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}

/** Vercel Cron issues a GET. POST is accepted so the job can be triggered manually. */
export async function GET(request: Request) {
  return runMaintenance(request);
}

export async function POST(request: Request) {
  return runMaintenance(request);
}
