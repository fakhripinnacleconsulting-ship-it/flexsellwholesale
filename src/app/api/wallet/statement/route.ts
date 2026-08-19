import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletTransaction from "@/models/WalletTransaction";
import WalletExpenseCategory from "@/models/WalletExpenseCategory";
import Customer from "@/models/Customer";
import { requireWalletRead } from "@/lib/walletGuard";
import { toRupees } from "@/lib/money";
import { formatDateTimeIST, formatFullIST, toISTDateKey } from "@/lib/datetime";
import { financialYearLabel } from "@/lib/dateRange";
import { isCreditType } from "@/lib/walletLedger";
import { WALLET_TYPES, WALLET_TERMS_TEXT } from "@/lib/walletConstants";

export const dynamic = "force-dynamic";

/**
 * Downloads a wallet statement as CSV.
 *
 * CSV rather than a PDF endpoint because the PDF is produced in the browser from the same
 * data the passbook already renders (see pdfPrintHelper) — generating a second, server-side
 * rendering of the same table would be two things to keep in agreement. CSV is what a
 * customer's accountant actually opens, and it has no such equivalent on the client.
 *
 * Every row is escaped for spreadsheet safety: a description beginning with `=` is a
 * formula to Excel, not text, and wallet descriptions are free text written by staff.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("userId");

    const auth = await requireWalletRead(requestedUserId);
    if (auth.error) return auth.error;
    const { payload } = auth;

    const userId = requestedUserId || payload.userId;
    const walletTypeParam = url.searchParams.get("walletType");

    /**
     * Accepts `all` alongside the two wallets — the third place this had to change.
     *
     * The breakdown and the passbook each validate `walletType` separately, and this route is
     * easy to miss: an All tab would appear to work everywhere until the customer pressed
     * Download and got a 400. Omitting the filter is what "all" already meant internally.
     */
    if (
      walletTypeParam &&
      walletTypeParam !== "all" &&
      !WALLET_TYPES.includes(walletTypeParam as (typeof WALLET_TYPES)[number])
    ) {
      return NextResponse.json({ message: "Unknown wallet type" }, { status: 400 });
    }

    // Normalised to undefined so every query below reads "no wallet filter" without repeating
    // the "all" special case at each site.
    const walletType = walletTypeParam === "all" ? undefined : walletTypeParam;

    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    await dbConnect();

    const query: Record<string, unknown> = { userId, status: { $in: ["success", "reversed"] } };
    if (walletType) query.walletType = walletType;

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

    const [rows, categories, customer, openingRow] = await Promise.all([
      // Oldest first: a statement reads forward in time, unlike the on-screen passbook
      // which shows the most recent activity first.
      WalletTransaction.find(query).sort({ createdAt: 1 }).limit(5000).lean(),

      WalletExpenseCategory.find({}).select("key label").lean() as Promise<
        Array<{ key: string; label: string }>
      >,

      Customer.findById(userId).select("name email").lean() as Promise<
        { name?: string; email?: string } | null
      >,

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

    const labels = new Map(categories.map((c) => [c.key, c.label]));
    const openingPaise = openingRow?.balanceAfter ?? 0;

    let credits = 0;
    let debits = 0;

    const dataRows = (rows as Array<Record<string, unknown>>).map((row) => {
      const credit = isCreditType(row.type as never);
      const amount = row.amount as number;
      if (row.status === "success") {
        if (credit) credits += amount;
        else debits += amount;
      }

      const categoryKey = row.expenseCategory as string | undefined;

      return [
        formatDateTimeIST(row.createdAt as string),
        row.receiptNumber as string,
        row.walletType === "business" ? "Business" : "Store",
        row.transactionName as string,
        (row.description as string) || "",
        categoryKey ? labels.get(categoryKey) || categoryKey : "",
        (row.orderId as string) || "",
        (row.referenceId as string) || "",
        credit ? toRupees(amount).toFixed(2) : "",
        credit ? "" : toRupees(amount).toFixed(2),
        toRupees(row.balanceAfter as number).toFixed(2),
        (row.createdBy as { name?: string })?.name || "",
        row.status as string,
      ];
    });

    const header = [
      "Date (IST)",
      "Receipt",
      "Wallet",
      "Particulars",
      "Description",
      "Category",
      "Order",
      "Reference",
      "Credit (INR)",
      "Debit (INR)",
      "Balance (INR)",
      "Recorded By",
      "Status",
    ];

    const closingPaise = openingPaise + credits - debits;

    const meta = [
      ["FlexSell Wholesale — Wallet Statement"],
      ["Customer", customer?.name || userId],
      ["Email", customer?.email || ""],
      ["Wallet", walletType === "business" ? "Business Wallet" : walletType === "store" ? "Store Wallet" : "All wallets"],
      ["Period", from && to ? `${formatDateTimeIST(from)} to ${formatDateTimeIST(to)}` : "All time"],
      ["Generated", formatFullIST(new Date())],
      [],
      ["Opening Balance", toRupees(openingPaise).toFixed(2)],
      ["Total Credits", toRupees(credits).toFixed(2)],
      ["Total Debits", toRupees(debits).toFixed(2)],
      ["Closing Balance", toRupees(closingPaise).toFixed(2)],
      [],
    ];

    const csv = [
      ...meta.map(toCsvRow),
      toCsvRow(header),
      ...dataRows.map(toCsvRow),
      "",
      toCsvRow([WALLET_TERMS_TEXT]),
    ].join("\r\n");

    // Named by the period it covers, not by the day it was downloaded. Someone with three
    // statements in a folder needs to tell them apart by what is inside them.
    const cleanName = (customer?.name || userId).replace(/[^a-zA-Z0-9_-]/g, "_");
    const period =
      from && to
        ? `${toISTDateKey(from)}_to_${toISTDateKey(to)}`
        : financialYearLabel().replace(/[\s-]/g, "_");
    const filename = `Wallet_Statement_${cleanName}_${period}.csv`;

    return new NextResponse(
      // The BOM makes Excel open a UTF-8 CSV correctly. Without it, the rupee sign and any
      // non-ASCII customer name arrive as mojibake on a default Windows install.
      "﻿" + csv,
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Statement export failed:", error);
    return NextResponse.json({ message: "Failed to generate the statement" }, { status: 500 });
  }
}

/**
 * Renders one CSV row.
 *
 * Prefixes anything starting with `=`, `+`, `-` or `@` with a single quote. Those characters
 * make a spreadsheet treat a cell as a formula, and wallet descriptions are free text typed
 * by staff — an exported statement must never execute when the customer's accountant opens it.
 */
function toCsvRow(cells: string[]): string {
  return cells
    .map((cell) => {
      const value = String(cell ?? "");
      const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${guarded.replace(/"/g, '""')}"`;
    })
    .join(",");
}
