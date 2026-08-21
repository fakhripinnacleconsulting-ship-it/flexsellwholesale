import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Customer from "@/models/Customer";
import Order from "@/models/Order";
import AdvanceBalance from "@/models/AdvanceBalance";
import Manager from "@/models/Manager";
import { requireAuth } from "@/lib/authGuard";
import { toRupees } from "@/lib/money";
import { validateCustomerKycRequirements } from "@/lib/kycValidationHelper";

export const dynamic = "force-dynamic";

/**
 * Customer-base analytics for the admin/manager customers page.
 *
 * Everything is computed in MongoDB rather than by loading customers and reducing in the
 * browser: the list page is paginated, so a client-side roll-up would only ever describe the
 * page in front of you, not the customer base.
 *
 * **What the date range does and does not touch** — the distinction the whole shape rests on:
 *
 *   - *Flows* are scoped to it: customers who joined in the range, revenue and orders placed
 *     in the range.
 *   - *Positions* are not: how many customers exist, what their advanceBalances hold right now, how
 *     many are waiting on KYC. A balance has one answer — today — and pretending it belongs to
 *     a period would make it read as "wallet revenue", which it is not.
 *
 * Each figure below says which it is.
 */

/** How long without an order before a customer counts as dormant. */
const DORMANT_DAYS = 90;

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const payload = auth.payload!;

    if (payload.role !== "admin" && payload.role !== "manager") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const requestedType = searchParams.get("customerType") || "";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    /**
     * A manager sees only the customer types their permissions cover — the same rule the
     * customer list applies. Without it the totals would describe a population the manager
     * is not allowed to browse, which is a quieter kind of leak but a leak all the same.
     */
    let allowedTypes: string[] | null = null;
    if (payload.role === "manager") {
      const managerDoc = (await Manager.findById(payload.userId).select("permissions status").lean()) as
        | { permissions?: string[]; status?: string }
        | null;
      if (!managerDoc || managerDoc.status !== "active") {
        return NextResponse.json({ message: "Forbidden: Account inactive" }, { status: 403 });
      }
      const perms = managerDoc.permissions || [];
      const has = (p: string) => perms.includes(p) || perms.some((x) => x.startsWith(`${p}:`));

      allowedTypes = [];
      if (has("customers_b2b")) allowedTypes.push("B2B");
      if (has("customers_b2c")) allowedTypes.push("B2C");
      if (has("customers_dropshipping") || has("customers_dropship")) allowedTypes.push("Dropshipping");

      if (allowedTypes.length === 0) {
        return NextResponse.json({ message: "Forbidden: No customer access" }, { status: 403 });
      }
    }

    // The population these numbers describe. Never includes admins.
    const baseMatch: Record<string, unknown> = { role: { $ne: "admin" } };
    if (requestedType) {
      if (allowedTypes && !allowedTypes.includes(requestedType)) {
        return NextResponse.json({ message: "Forbidden customer type" }, { status: 403 });
      }
      baseMatch.customerTypes = requestedType;
    } else if (allowedTypes) {
      baseMatch.customerTypes = { $in: allowedTypes };
    }

    // Default: the last three months. Long enough for a wholesale buying cycle to show up.
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = startDateParam ? new Date(startDateParam) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d;
    })();
    startDate.setHours(0, 0, 0, 0);

    /** `null` means "all time" — the caller asked for no lower bound. */
    const isAllTime = startDateParam === "all";
    const rangeMatch = isAllTime ? {} : { createdAt: { $gte: startDate, $lte: endDate } };

    /**
     * The customers in scope, with the fields the derived metrics need.
     *
     * Orders and advanceBalances are joined on these ids rather than re-deriving the customer filter
     * in three separate aggregations. The projection also carries what KYC validation reads —
     * **KYC is not a stored field**. There is no `kycStatus` on the schema; completeness is
     * computed from the customer's type, company, GSTIN and uploaded documents by
     * `validateCustomerKycRequirements`, which is what the list page's own KYC filter uses.
     * Counting `{ kycStatus: "Pending" }` would have matched nothing and quietly reported
     * zero outstanding KYC forever.
     */
    const scopedCustomers = (await Customer.find(baseMatch)
      .select("_id email customerTypes company storeName gstin kycDocuments upgradeStatus")
      .lean()) as {
      _id: string;
      email?: string;
      customerTypes?: string[];
      company?: string;
      storeName?: string;
      gstin?: string;
      kycDocuments?: Record<string, string>;
      upgradeStatus?: string;
    }[];
    const scopedIds = scopedCustomers.map((c) => String(c._id));
    const scopedEmails = scopedCustomers
      .map((c) => (c.email || "").toLowerCase())
      .filter(Boolean);

    // Derived in the same place, from the same rule, as the page's KYC filter.
    let kycIncomplete = 0;
    let upgradesPending = 0;
    for (const c of scopedCustomers) {
      if (c.upgradeStatus === "pending") upgradesPending += 1;
      const verdict = validateCustomerKycRequirements({
        customerTypes: (c.customerTypes || ["B2C"]) as ("B2C" | "B2B" | "Dropshipping")[],
        company: c.company || "",
        storeName: c.storeName,
        gstin: c.gstin || "",
        kycDocuments: c.kycDocuments || {},
      });
      if (!verdict.isValid) kycIncomplete += 1;
    }

    const [segmentAgg, newInRange, orderAgg, topCustomerAgg, advanceBalanceAgg, , dormantCount] =
      await Promise.all([
        // ─── Segment counts (position) ───
        Customer.aggregate([
          { $match: baseMatch },
          { $unwind: { path: "$customerTypes", preserveNullAndEmptyArrays: true } },
          { $group: { _id: { $ifNull: ["$customerTypes", "B2C"] }, count: { $sum: 1 } } },
        ]),

        // ─── Customers who joined in the range (flow) ───
        Customer.countDocuments({ ...baseMatch, ...rangeMatch }),

        /**
         * ─── Revenue in the range (flow) ───
         *
         * Cancelled orders are excluded, matching how the dashboard computes net sales, so
         * the two pages cannot disagree about what "revenue" means.
         */
        Order.aggregate([
          {
            $match: {
              status: { $ne: "Cancelled" },
              ...(isAllTime ? {} : { createdAt: { $gte: startDate, $lte: endDate } }),
              $or: [
                { customerId: { $in: scopedIds } },
                { "shippingAddress.email": { $in: scopedEmails } },
              ],
            },
          },
          {
            $group: {
              _id: null,
              revenue: { $sum: "$amount" },
              orderCount: { $sum: 1 },
              buyers: { $addToSet: { $ifNull: ["$customerId", "$shippingAddress.email"] } },
            },
          },
        ]),

        // ─── Top customers by spend in the range (flow) ───
        Order.aggregate([
          {
            $match: {
              status: { $ne: "Cancelled" },
              ...(isAllTime ? {} : { createdAt: { $gte: startDate, $lte: endDate } }),
              $or: [
                { customerId: { $in: scopedIds } },
                { "shippingAddress.email": { $in: scopedEmails } },
              ],
            },
          },
          {
            $group: {
              _id: { $ifNull: ["$customerId", "$shippingAddress.email"] },
              name: { $first: "$customerName" },
              spend: { $sum: "$amount" },
              orders: { $sum: 1 },
            },
          },
          { $sort: { spend: -1 } },
          { $limit: 5 },
        ]),

        /**
         * ─── Advance Balance holdings (position — no date filter, by design) ───
         *
         * Grouped **by Advance Balance type**, so the card can show the same Store / Business split as
         * the dashboard rather than a single opaque figure.
         */
        AdvanceBalance.aggregate([
          { $match: { status: { $ne: "closed" }, userId: { $in: scopedIds } } },
          {
            $group: {
              _id: "$type",
              available: { $sum: "$availableBalance" },
              held: { $sum: "$heldBalance" },
              lowBalance: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$availableBalance", 0] },
                        { $lt: ["$availableBalance", "$lowBalanceThreshold"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              customers: { $addToSet: "$userId" },
            },
          },
        ]),

        // Upgrade requests and KYC completeness are derived above, from `scopedCustomers`.
        Promise.resolve(null),

        /**
         * ─── Dormant customers (position) ───
         *
         * Someone who has not ordered in 90 days. Counted as "customers in scope minus those
         * with a recent order" rather than by scanning every customer's order history, which
         * would be a query per customer.
         */
        (async () => {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);
          // `as never` for the filter: Mongoose types `distinct`'s filter against the field's
          // own type rather than the document, so a `createdAt` range on a string field is
          // rejected at compile time even though it is a perfectly ordinary query.
          const recentBuyers = await Order.distinct("customerId", {
            createdAt: { $gte: cutoff },
            customerId: { $in: scopedIds },
          } as never);
          return Math.max(0, scopedIds.length - recentBuyers.filter(Boolean).length);
        })(),
      ]);

    const segments: Record<string, number> = { B2B: 0, B2C: 0, Dropshipping: 0 };
    for (const row of segmentAgg as { _id: string; count: number }[]) {
      if (row._id && segments[row._id] !== undefined) segments[row._id] = row.count;
    }

    const revenueRow = (orderAgg as { revenue?: number; orderCount?: number; buyers?: unknown[] }[])[0];
    const revenue = revenueRow?.revenue || 0;
    const orderCount = revenueRow?.orderCount || 0;
    const buyingCustomers = (revenueRow?.buyers || []).filter(Boolean).length;

    /**
     * Folded into Store / Business / held.
     *
     * `customersWithBalance` is a set union across both Advance Balance types, not a sum — one customer
     * holding money in both advanceBalances is one customer, and adding the per-type counts would
     * double them.
     */
    const advanceBalanceRows = advanceBalanceAgg as {
      _id: string;
      available?: number;
      held?: number;
      lowBalance?: number;
      customers?: string[];
    }[];

    const advanceBalanceTotals = { store: 0, business: 0, held: 0, lowBalanceAccounts: 0 };
    const fundedCustomerIds = new Set<string>();
    for (const row of advanceBalanceRows) {
      if (row._id === "store") advanceBalanceTotals.store = row.available || 0;
      if (row._id === "business") advanceBalanceTotals.business = row.available || 0;
      advanceBalanceTotals.held += row.held || 0;
      advanceBalanceTotals.lowBalanceAccounts += row.lowBalance || 0;
      for (const id of row.customers || []) fundedCustomerIds.add(String(id));
    }

    return NextResponse.json(
      {
        scope: {
          customerType: requestedType || "all",
          startDate: isAllTime ? "all" : startDate.toISOString().split("T")[0],
          endDate: isAllTime ? "all" : endDate.toISOString().split("T")[0],
        },

        // Positions — true right now, whatever the range says.
        segments: {
          total: scopedIds.length,
          ...segments,
        },
        advanceBalance: {
          // The headline: everything held for these customers, spendable or reserved.
          total: toRupees(advanceBalanceTotals.store + advanceBalanceTotals.business + advanceBalanceTotals.held),
          store: toRupees(advanceBalanceTotals.store),
          business: toRupees(advanceBalanceTotals.business),
          held: toRupees(advanceBalanceTotals.held),
          customersWithBalance: fundedCustomerIds.size,
          lowBalanceAccounts: advanceBalanceTotals.lowBalanceAccounts,
        },
        actionNeeded: {
          upgradesPending,
          kycIncomplete,
          dormant: dormantCount || 0,
          dormantAfterDays: DORMANT_DAYS,
        },

        // Flows — scoped to the range above.
        growth: {
          newCustomers: newInRange || 0,
        },
        revenue: {
          total: revenue,
          orders: orderCount,
          buyingCustomers,
          averageOrderValue: orderCount > 0 ? Math.round(revenue / orderCount) : 0,
          revenuePerBuyer: buyingCustomers > 0 ? Math.round(revenue / buyingCustomers) : 0,
        },
        topCustomers: (topCustomerAgg as { _id: string; name?: string; spend: number; orders: number }[]).map(
          (row) => ({
            id: String(row._id),
            name: row.name || String(row._id),
            spend: row.spend || 0,
            orders: row.orders || 0,
          })
        ),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    console.error("[Customers] Analytics failed:", error);
    return NextResponse.json(
      { message: (error as Error).message || "Failed to load customer analytics" },
      { status: 500 }
    );
  }
}
