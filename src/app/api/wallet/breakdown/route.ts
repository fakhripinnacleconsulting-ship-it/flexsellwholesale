import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletTransaction from "@/models/WalletTransaction";
import WalletExpenseCategory from "@/models/WalletExpenseCategory";
import { requireWalletRead } from "@/lib/walletGuard";
import { toRupees } from "@/lib/money";
import { WALLET_TYPES, BREAKDOWN_MAX_SLICES } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

const OTHER_COLOUR = "#94a3b8";

/**
 * Slices that are not expense categories.
 *
 * A transfer to the Business Wallet is money that genuinely left the Store Wallet, so it has
 * to be accounted for here — but it is a movement, not a spend, and giving it a real category
 * would put it in the same list an admin edits. A distinct colour keeps it visibly different
 * from actual expenditure in the donut.
 */
const SYNTHETIC_SLICES: Record<string, { label: string; colour: string }> = {
  __TRANSFER_OUT: { label: "Transferred to Business Wallet", colour: "#0ea5e9" },
};

/**
 * "Where your money went" — spend grouped by expense category for a date range.
 *
 * The customer's real question is not "what is my balance" but "where did my ₹15,000 go",
 * and this is the answer. Everything is grouped in the database rather than by pulling
 * transactions and summing them in JS: the totals are the whole point of the screen, and a
 * client-side sum would get slower exactly as a customer's history grows.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");

    const auth = await requireWalletRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;
    const walletType = url.searchParams.get("walletType") || "business";

    if (!WALLET_TYPES.includes(walletType as (typeof WALLET_TYPES)[number])) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }

    // Default to the current Indian financial year, which is the window a business owner
    // actually thinks in — not the last 30 days.
    const { from, to } = resolveRange(url.searchParams.get("from"), url.searchParams.get("to"));

    await dbConnect();

    const [groups, categories] = await Promise.all([
      WalletTransaction.aggregate([
        {
          $match: {
            userId,
            walletType,
            status: "success",
            // Only outbound money.
            type: { $in: ["DEBIT", "ADJUSTMENT", "TRANSFER_OUT"] },
            /**
             * A transfer out has no expense category, and the `expenseCategory: { $exists:
             * true }` clause that used to sit here removed it again — so money moved from the
             * Store Wallet to the Business Wallet left the wallet and then failed to appear
             * in that wallet's own "where did it go" chart.
             *
             * Categoryless *order payments* must still be excluded (they belong in the
             * passbook), so the filter is by type rather than by the absence of a category.
             */
            $or: [
              { expenseCategory: { $exists: true, $ne: null } },
              { type: "TRANSFER_OUT" },
            ],
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            // A transfer is not an expense *category*, so rather than inventing one it is
            // grouped under a synthetic key the slice mapper below gives a fixed label.
            _id: { $ifNull: ["$expenseCategory", { $concat: ["__", "$type"] }] },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]) as Promise<Array<{ _id: string; total: number; count: number }>>,

      WalletExpenseCategory.find({}).select("key label colour").lean() as Promise<
        Array<{ key: string; label: string; colour: string }>
      >,
    ]);

    // Labels and colours come from the category document, so a category keeps the same
    // colour on every screen and in every period. A chart that reshuffles its colours
    // between months is worse than one with no colour at all.
    const meta = new Map(categories.map((c) => [c.key, c]));

    const totalPaise = groups.reduce((sum, g) => sum + g.total, 0);

    const named = groups.map((g) => {
      const synthetic = SYNTHETIC_SLICES[g._id];
      return {
        categoryKey: g._id,
        // A deactivated category still resolves here; only a hard delete would break it, and
        // the categories route deliberately offers no delete.
        label: synthetic?.label || meta.get(g._id)?.label || g._id,
        colour: synthetic?.colour || meta.get(g._id)?.colour || OTHER_COLOUR,
        totalPaise: g.total,
        count: g.count,
      };
    });

    /**
     * Beyond six slices a donut stops being information and becomes a colour wheel, so the
     * tail is folded into "Other". The full list is still available in the passbook — this
     * collapses the *chart*, not the data.
     */
    const head = named.slice(0, BREAKDOWN_MAX_SLICES);
    const tail = named.slice(BREAKDOWN_MAX_SLICES);

    if (tail.length > 0) {
      head.push({
        categoryKey: "__other__",
        label: `Other (${tail.length} categories)`,
        colour: OTHER_COLOUR,
        totalPaise: tail.reduce((sum, t) => sum + t.totalPaise, 0),
        count: tail.reduce((sum, t) => sum + t.count, 0),
      });
    }

    return NextResponse.json(
      {
        walletType,
        from: from.toISOString(),
        to: to.toISOString(),
        totalSpent: toRupees(totalPaise),
        slices: head.map((s) => ({
          categoryKey: s.categoryKey,
          label: s.label,
          colour: s.colour,
          total: toRupees(s.totalPaise),
          // Rounded for display only. The rupee figure beside it is the real number, so a
          // percentage that does not sum to exactly 100 never misrepresents an amount.
          percent: totalPaise > 0 ? Math.round((s.totalPaise / totalPaise) * 1000) / 10 : 0,
          count: s.count,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Breakdown failed:", error);
    return NextResponse.json({ message: "Failed to load the spend breakdown" }, { status: 500 });
  }
}

/**
 * Resolves the requested range, defaulting to the current Indian financial year
 * (1 April – 31 March).
 */
function resolveRange(fromParam: string | null, toParam: string | null): { from: Date; to: Date } {
  if (fromParam && toParam) {
    const from = new Date(fromParam);
    const to = new Date(toParam);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      // Include the whole closing day — a range ending "31 March" that stops at midnight
      // silently drops that day's transactions.
      to.setHours(23, 59, 59, 999);
      return { from, to };
    }
  }

  const now = new Date();
  const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: new Date(fyStartYear, 3, 1), to: now };
}
