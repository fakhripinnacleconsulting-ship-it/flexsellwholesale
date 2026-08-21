import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import AdvanceBalanceTransaction from "@/models/AdvanceBalanceTransaction";
import AdvanceBalanceExpenseCategory from "@/models/AdvanceBalanceExpenseCategory";
import { requireAdvanceBalanceRead } from "@/lib/advanceBalanceGuard";
import { toRupees } from "@/lib/money";
import { ADVANCE_BALANCE_TYPES, PASSBOOK_PAGE_SIZE } from "@/lib/advanceBalanceConstants";
import { isCreditType } from "@/lib/advanceBalanceLedger";

export const dynamic = "force-dynamic";

/**
 * The passbook: a page of ledger entries, plus the balances that make the range
 * reconcilable.
 *
 * Opening and closing balances are what turn a list of rows into a statement — without
 * them a customer's accountant cannot check the range against anything.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");

    const auth = await requireAdvanceBalanceRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;
    const isStaff = payload.role === "admin" || payload.role === "manager";

    /**
     * `all` is an explicit scope, not an absent one.
     *
     * Omitting the parameter already meant "both wallets" here, but the literal string `all`
     * was rejected with a 400 — so a UI with an All tab appeared to work until it asked for
     * it. Normalising it to `undefined` keeps the query below untouched.
     */
    const advanceBalanceTypeParam = url.searchParams.get("walletType");
    if (
      advanceBalanceTypeParam &&
      advanceBalanceTypeParam !== "all" &&
      !ADVANCE_BALANCE_TYPES.includes(advanceBalanceTypeParam as (typeof ADVANCE_BALANCE_TYPES)[number])
    ) {
      return NextResponse.json({ message: "Unknown Advance Balance type" }, { status: 400 });
    }

    const isAllWallets = !advanceBalanceTypeParam || advanceBalanceTypeParam === "all";
    const walletType = isAllWallets ? undefined : advanceBalanceTypeParam;

    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const limitParam = Number(url.searchParams.get("limit"));
    const pageSize = limitParam > 0 ? limitParam : PASSBOOK_PAGE_SIZE;
    const category = url.searchParams.get("category");
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    await dbConnect();

    const query: Record<string, unknown> = { userId };
    if (walletType) query.walletType = walletType;
    if (category) query.expenseCategory = category;

    /**
     * Pending and failed rows are hidden from customers but visible to staff.
     *
     * A pending recharge is not yet part of the ledger — showing it beside settled entries
     * would imply money that has not arrived. Staff need to see them precisely because
     * those are the ones that require action.
     */
    if (!isStaff) query.status = { $in: ["success", "reversed"] };

    let from: Date | null = null;
    let to: Date | null = null;
    if (fromParam && toParam) {
      const f = new Date(fromParam);
      const t = new Date(toParam);
      if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime())) {
        t.setHours(23, 59, 59, 999);
        from = f;
        to = t;
        query.createdAt = { $gte: f, $lte: t };
      }
    }

    const [rows, totalCount, categories, rangeTotals, openingRow] = await Promise.all([
      AdvanceBalanceTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      AdvanceBalanceTransaction.countDocuments(query),

      AdvanceBalanceExpenseCategory.find({}).select("key label colour").lean() as Promise<
        Array<{ key: string; label: string; colour: string }>
      >,

      AdvanceBalanceTransaction.aggregate([
        { $match: { ...query, status: "success" } },
        {
          $group: {
            _id: null,
            credits: {
              $sum: {
                $cond: [{ $in: ["$type", ["CREDIT", "REFUND", "TRANSFER_IN"]] }, "$amount", 0],
              },
            },
            debits: {
              $sum: {
                $cond: [{ $in: ["$type", ["CREDIT", "REFUND", "TRANSFER_IN"]] }, 0, "$amount"],
              },
            },
          },
        },
      ]) as Promise<Array<{ credits: number; debits: number }>>,

      /**
       * The opening balance is the `balanceAfter` of the last entry *before* the range —
       * a stored value, not a recomputation. Replaying the ledger from the beginning to
       * derive it would get slower every month and could disagree with what the customer
       * was shown at the time.
       */
      from
        ? (AdvanceBalanceTransaction.findOne({
            userId,
            ...(walletType ? { walletType } : {}),
            status: "success",
            createdAt: { $lt: from },
          })
            .sort({ createdAt: -1 })
            .select("balanceAfter")
            .lean() as Promise<{ balanceAfter?: number } | null>)
        : Promise.resolve(null),
    ]);

    const meta = new Map(categories.map((c) => [c.key, c]));
    const credits = rangeTotals[0]?.credits || 0;
    const debits = rangeTotals[0]?.debits || 0;
    const openingPaise = openingRow?.balanceAfter ?? 0;

    const transactions = (rows as Array<Record<string, unknown>>).map((row) => {
      const type = row.type as string;
      const credit = isCreditType(type as never);
      const categoryKey = row.expenseCategory as string | undefined;

      return {
        _id: String(row._id),
        createdAt: row.createdAt,
        walletType: row.walletType,
        type,
        source: row.source,
        direction: credit ? ("credit" as const) : ("debit" as const),
        transactionName: row.transactionName,
        description: row.description,
        expenseCategory: categoryKey,
        categoryLabel: categoryKey ? meta.get(categoryKey)?.label || categoryKey : undefined,
        categoryColour: categoryKey ? meta.get(categoryKey)?.colour : undefined,
        amount: toRupees(row.amount as number),
        balanceAfter: toRupees(row.balanceAfter as number),
        receiptNumber: row.receiptNumber,
        referenceId: row.referenceId,
        orderId: row.orderId,
        invoiceId: row.invoiceId,
        proofUrl: row.proofUrl,
        status: row.status,
        // The acting person, shown to the customer as well as to staff. With no approval
        // step, this is their only view of who is spending their money.
        actedBy: (row.createdBy as { name?: string; role?: string })?.name,
        actedByRole: (row.createdBy as { name?: string; role?: string })?.role,
      };
    });

    return NextResponse.json(
      {
        walletType: walletType || "all",
        /**
         * Tells the passbook that a running balance is not meaningful here.
         *
         * `balanceAfter` and the opening/closing pair are **per-wallet** figures. Interleaving
         * two wallets' rows by date produces a Balance column that jumps between two unrelated
         * running totals — a number that looks authoritative and is not. The UI hides the
         * column when this is set rather than printing it.
         */
        combined: isAllWallets,
        from: from?.toISOString() || null,
        to: to?.toISOString() || null,
        // Withheld in combined mode for the same reason: there is no single balance to state.
        openingBalance: isAllWallets ? null : toRupees(openingPaise),
        closingBalance: isAllWallets ? null : toRupees(openingPaise + credits - debits),
        // Totals stay meaningful across advanceBalances — they are sums, not running positions.
        totalCredits: toRupees(credits),
        totalDebits: toRupees(debits),
        page,
        pageSize,
        totalCount,
        totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
        transactions,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[advanceBalance] Transactions fetch failed:", error);
    return NextResponse.json({ message: "Failed to load transactions" }, { status: 500 });
  }
}
