import { NextResponse, NextRequest } from "next/server";
import dbConnect from "@/lib/dbConnect";
import WalletTransaction from "@/models/WalletTransaction";
import { requireWalletAdmin } from "@/lib/walletGuard";
import { toRupees } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Every credit that did not come from the payment gateway, in one place.
 *
 * Cash credits visible only inside individual customer wallets will never be reviewed
 * together, and a pattern across customers is exactly what a single wallet cannot show.
 * This is the review surface that makes the offline-credit route's audit trail useful
 * rather than merely present.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireWalletAdmin();
    if (auth.error) return auth.error;

    await dbConnect();

    const url = new URL(request.url);
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
    const adminId = url.searchParams.get("adminId");
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query: Record<string, unknown> = {
      "metadata.offlineCredit": true,
      createdAt: { $gte: since },
    };
    if (adminId) query["createdBy.userId"] = adminId;

    const [rows, byAdmin] = await Promise.all([
      WalletTransaction.find(query)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),

      // Grouped in the database, not in JS: the point of this screen is the totals, and
      // pulling every row to sum them would get slower exactly as the risk grows.
      WalletTransaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: { admin: "$createdBy.name", source: "$source" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
    ]);

    const entries = (rows as Array<Record<string, unknown>>).map((row) => ({
      _id: String(row._id),
      createdAt: row.createdAt,
      userId: row.userId,
      walletType: row.walletType,
      source: row.source,
      amount: toRupees(row.amount as number),
      referenceId: row.referenceId,
      description: row.description,
      proofUrl: row.proofUrl,
      status: row.status,
      receiptNumber: row.receiptNumber,
      recordedBy: (row.createdBy as { name?: string })?.name || "Unknown",
      recordedByIp: (row.metadata as { recordedByIp?: string })?.recordedByIp,
    }));

    const summary = (byAdmin as Array<{ _id: { admin?: string; source?: string }; total: number; count: number }>)
      .map((g) => ({
        admin: g._id.admin || "Unknown",
        source: g._id.source,
        total: toRupees(g.total),
        count: g.count,
      }));

    return NextResponse.json(
      {
        days,
        totalCredited: toRupees(
          (byAdmin as Array<{ total: number }>).reduce((sum, g) => sum + g.total, 0)
        ),
        summary,
        entries,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Wallet] Offline register failed:", error);
    return NextResponse.json({ message: "Failed to load the offline credit register" }, { status: 500 });
  }
}
