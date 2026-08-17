import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Wallet from "@/models/Wallet";
import WalletTransaction from "@/models/WalletTransaction";
import Customer from "@/models/Customer";
import { requireWalletRead } from "@/lib/walletGuard";
import { settleStuckRecharges } from "@/lib/walletMaintenance";
import { toRupees } from "@/lib/money";
import { getWalletRechargeAvailability } from "@/lib/commerceSettings";
import {
  BUSINESS_WALLET_TIERS,
  RECHARGE_SWEEP_AFTER_MINUTES,
  type WalletType,
} from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

interface WalletDoc {
  _id: string;
  type: WalletType;
  totalCredited: number;
  totalDebited: number;
  availableBalance: number;
  heldBalance: number;
  lowBalanceThreshold: number;
  status: string;
}

const toApi = (w: WalletDoc | undefined) =>
  w
    ? {
        _id: String(w._id),
        type: w.type,
        totalCredited: toRupees(w.totalCredited),
        totalDebited: toRupees(w.totalDebited),
        availableBalance: toRupees(w.availableBalance),
        heldBalance: toRupees(w.heldBalance),
        lowBalanceThreshold: toRupees(w.lowBalanceThreshold),
        status: w.status,
        // Computed here so the banner logic cannot drift between the two places that show it.
        isLowBalance: w.availableBalance < w.lowBalanceThreshold,
      }
    : null;

/**
 * Both wallets for a customer, with balances.
 *
 * Amounts leave here as **rupees**. Paise exist only inside the database and the server-side
 * helpers, so no component can ever be handed a value it might render a hundred times too
 * large.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");

    // Staff pass ?userId to view a customer's wallets; a customer reads their own.
    const auth = await requireWalletRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;

    await dbConnect();

    /**
     * Lazy settlement.
     *
     * The customer waiting for a lost webhook is the person loading this page, so this is
     * both the cheapest and the fastest place to check: nothing runs when nobody is
     * waiting, and when someone is, they wait seconds rather than until the daily cron.
     *
     * Scoped to this customer and gated behind an indexed existence check, so the common
     * case — no pending payments — costs one count query and never touches Razorpay.
     */
    if (payload.role === "customer") {
      const cutoff = new Date(Date.now() - RECHARGE_SWEEP_AFTER_MINUTES * 60 * 1000);
      const stuckCount = await WalletTransaction.countDocuments({
        userId,
        status: "pending",
        source: "razorpay",
        createdAt: { $lt: cutoff },
      });

      if (stuckCount > 0) {
        try {
          await settleStuckRecharges({ userId, limit: 5 });
        } catch (err) {
          // Never let a settlement failure blank the page. The balance shown may be stale
          // by one recharge; an error screen would be worse and would hide the rest.
          console.error("[Wallet] Lazy settlement failed:", err);
        }
      }
    }

    const [wallets, customer, recharge] = await Promise.all([
      Wallet.find({ userId })
        .select("type totalCredited totalDebited availableBalance heldBalance lowBalanceThreshold status")
        .lean() as Promise<WalletDoc[]>,
      Customer.findById(userId).select("customerTypes upgradeStatus role").lean() as Promise<
        { customerTypes?: string[]; upgradeStatus?: string; role?: string } | null
      >,
      // Surfaced so both UIs can hide the top-up button and explain why in one call,
      // rather than discovering the refusal only after the customer clicks.
      getWalletRechargeAvailability(),
    ]);

    if (!customer || customer.role === "admin") {
      return NextResponse.json({ message: "No wallets for this account" }, { status: 404 });
    }

    const businessEligible = (customer.customerTypes || []).some((t) =>
      (BUSINESS_WALLET_TIERS as readonly string[]).includes(t)
    );

    return NextResponse.json(
      {
        store: toApi(wallets.find((w) => w.type === "store")),
        business: toApi(wallets.find((w) => w.type === "business")),
        businessEligible,
        // Surfaced here so the wallet page can show the KYC banner without a second call —
        // a customer whose Business Wallet balance is unusable must see why on this screen.
        kycApproved: customer.upgradeStatus === "approved",
        onlineRechargeAvailable: recharge.available,
        onlineRechargeReason: recharge.reason,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Fetch failed:", error);
    return NextResponse.json({ message: "Failed to load wallets" }, { status: 500 });
  }
}
