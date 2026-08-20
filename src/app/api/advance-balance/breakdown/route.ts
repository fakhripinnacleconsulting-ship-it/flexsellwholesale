import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AdvanceBalanceTransaction from "@/models/AdvanceBalanceTransaction";
import AdvanceBalanceExpenseCategory from "@/models/AdvanceBalanceExpenseCategory";
import { requireAdvanceBalanceRead } from "@/lib/advanceBalanceGuard";
import { toRupees } from "@/lib/money";
import { BREAKDOWN_MAX_SLICES } from "@/lib/advanceBalanceConstants";

export const dynamic = "force-dynamic";

const OTHER_COLOUR = "#94a3b8";

/**
 * Slices that are not expense categories.
 *
 * A transfer to the Business Advance Balance is money that genuinely left the Store Advance Balance, so it has
 * to be accounted for here — but it is a movement, not a spend, and giving it a real category
 * would put it in the same list an admin edits. A distinct colour keeps it visibly different
 * from actual expenditure in the donut.
 */
const SYNTHETIC_SLICES: Record<string, { label: string; colour: string }> = {
  /**
   * Money spent on orders — for most customers the largest slice by far, and until now
   * missing entirely. An order paid from the Advance Balance is a `DEBIT` carrying an `orderId` and
   * **no** `expenseCategory`: categories describe staff-recorded services, not purchases. The
   * filter here required a category, so every purchase was dropped and the panel reported a
   * total that was a fraction of what actually left the wallet.
   */
  __ORDER: { label: "Orders & Purchases", colour: "#8b5cf6" },

  __TRANSFER_OUT: { label: "Transferred to Business Advance Balance", colour: "#0ea5e9" },
  __ADJUSTMENT: { label: "Adjustments & Deductions", colour: "#64748b" },
  __DEBIT: { label: "Other Debits", colour: "#ec4899" },
};

/** `all` shows both advanceBalances together; the two literal advanceBalances show one each. */
const BREAKDOWN_SCOPES = ["all", "store", "business"] as const;
type BreakdownScope = (typeof BREAKDOWN_SCOPES)[number];

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

    const auth = await requireAdvanceBalanceRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;
    const scope = (url.searchParams.get("walletType") || "all") as BreakdownScope;

    if (!BREAKDOWN_SCOPES.includes(scope)) {
      return NextResponse.json({ message: "Unknown Advance Balance type" }, { status: 400 });
    }

    const isAllWallets = scope === "all";

    /**
     * A transfer between the customer's own advanceBalances is spend **only from the Advance Balance it left**.
     *
     * Viewed across both, nothing was spent — the money moved from one pocket to the other,
     * and whatever the Business Advance Balance later spent is already counted on its own. Including
     * it in the combined view would report a larger total than the customer ever spent, which
     * is the same class of error this panel exists to correct.
     */
    const outboundTypes = isAllWallets ? ["DEBIT", "ADJUSTMENT"] : ["DEBIT", "ADJUSTMENT", "TRANSFER_OUT"];

    // Default to the current Indian financial year, which is the window a business owner
    // actually thinks in — not the last 30 days.
    const { from, to } = resolveRange(url.searchParams.get("from"), url.searchParams.get("to"));

    await dbConnect();

    const [groups, categories] = await Promise.all([
      AdvanceBalanceTransaction.aggregate([
        {
          $match: {
            userId,
            // Omitted entirely for `all`, so both advanceBalances aggregate together.
            ...(isAllWallets ? {} : { walletType: scope }),
            status: "success",
            /**
             * Every outbound entry, with **no category requirement**.
             *
             * This filter used to demand `expenseCategory` (or a `TRANSFER_OUT`), which
             * silently dropped every order paid from the Advance Balance — those carry an `orderId`
             * and no category, because categories describe staff-recorded services rather
             * than purchases. Measured against the live ledger, that hid 56% of all spend and
             * left the panel reporting a total the customer could not reconcile.
             */
            type: { $in: outboundTypes },
            createdAt: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            /**
             * A real expense category wins. Failing that the entry is grouped by *what it is*
             * — an order payment, a transfer, an adjustment — under a synthetic key the slice
             * mapper below gives a fixed label and colour.
             *
             * Inventing an expense category for these would be worse: they would then appear
             * in the admin's editable category list, which is for services the business
             * actually performs.
             */
            _id: {
              $ifNull: [
                "$expenseCategory",
                {
                  $cond: [
                    { $ifNull: ["$orderId", false] },
                    "__ORDER",
                    { $concat: ["__", "$type"] },
                  ],
                },
              ],
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]) as Promise<Array<{ _id: string; total: number; count: number }>>,

      AdvanceBalanceExpenseCategory.find({}).select("key label colour").lean() as Promise<
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
        walletType: scope,
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
    console.error("[advanceBalance] Breakdown failed:", error);
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
