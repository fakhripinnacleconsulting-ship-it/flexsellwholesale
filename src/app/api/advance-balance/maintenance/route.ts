import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import {
  settleStuckRecharges,
  releaseExpiredHolds,
  reconcileAdvanceBalances,
} from "@/lib/advanceBalanceMaintenance";
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
 * a customer opens their Advance Balance, so nobody waits a day for money they have already paid.
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
  // Advance Balance, and running them concurrently would make the reconciliation that follows race
  // against its own inputs.
  const recharges = await settleStuckRecharges({ limit: 200 });
  const holds = await releaseExpiredHolds();
  const drift = await reconcileAdvanceBalances();

  if (drift.length > 0) {
    // Loud on purpose. Drift means the ledger and the balance disagree, which no customer
    // can detect from the UI — they simply see a number that is wrong. Nothing here
    // "corrects" it: an automatic fix would hide the bug that caused it.
    console.error(
      `[Advance Balance Reconciliation] DRIFT DETECTED on ${drift.length} Advance Balance(s):\n` +
        drift
          .map(
            (d) =>
              `  ${d.walletType} Advance Balance ${d.walletId} (customer ${d.userId}): ` +
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
        data: { driftCount: drift.length, advanceBalances: drift },
      });
    } catch (err) {
      console.error("[Advance Balance Reconciliation] Failed to raise drift alert:", err);
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
    console.warn(`[Advance Balance Maintenance] ${JSON.stringify(summary)}`);
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
