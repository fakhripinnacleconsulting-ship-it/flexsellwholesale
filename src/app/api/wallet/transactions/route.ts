import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletTransaction from "@/models/WalletTransaction";
import WalletExpenseCategory from "@/models/WalletExpenseCategory";
import { requireWalletRead } from "@/lib/walletGuard";
import { toRupees } from "@/lib/money";
import { WALLET_TYPES, PASSBOOK_PAGE_SIZE } from "@/lib/walletConstants";
import { isCreditType } from "@/lib/walletLedger";

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

    const auth = await requireWalletRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;
    const isStaff = payload.role === "admin" || payload.role === "manager";

    const walletType = url.searchParams.get("walletType");
    if (walletType && !WALLET_TYPES.includes(walletType as (typeof WALLET_TYPES)[number])) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }

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
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),

      WalletTransaction.countDocuments(query),

      WalletExpenseCategory.find({}).select("key label colour").lean() as Promise<
        Array<{ key: string; label: string; colour: string }>
      >,

      WalletTransaction.aggregate([
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
        ? (WalletTransaction.findOne({
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
        from: from?.toISOString() || null,
        to: to?.toISOString() || null,
        openingBalance: toRupees(openingPaise),
        closingBalance: toRupees(openingPaise + credits - debits),
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
    console.error("[Wallet] Transactions fetch failed:", error);
    return NextResponse.json({ message: "Failed to load transactions" }, { status: 500 });
  }
}
