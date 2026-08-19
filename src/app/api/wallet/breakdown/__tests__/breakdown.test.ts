import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * "Where your money went" must account for **every rupee that left**.
 *
 * The filter used to require an `expenseCategory` (or a `TRANSFER_OUT`), which silently
 * dropped every order paid from the wallet — those carry an `orderId` and no category, because
 * categories describe staff-recorded services rather than purchases. Measured against the live
 * ledger that hid 56% of all spend, and the panel reported a total the customer could not
 * reconcile against their own passbook.
 *
 * The property worth asserting is not which labels appear; it is that the slices **sum to the
 * outbound total**. That is what the original bug violated.
 */

vi.mock("@/lib/dbConnect", () => ({ default: vi.fn().mockResolvedValue(true) }));

const mockAggregate = vi.fn();
vi.mock("@/models/WalletTransaction", () => ({
  default: { aggregate: (...a: unknown[]) => mockAggregate(...a) },
}));

vi.mock("@/models/WalletExpenseCategory", () => ({
  default: { find: () => ({ select: () => ({ lean: () => Promise.resolve([
    { key: "gst_registration", label: "GST Registration", colour: "#10b981" },
  ]) }) }) },
}));

const mockWalletRead = vi.fn();
vi.mock("@/lib/walletGuard", () => ({
  requireWalletRead: (...a: unknown[]) => mockWalletRead(...a),
}));

import { GET } from "../route";

/** Runs the route and returns its parsed body. */
async function call(params: string) {
  const res = await GET(new Request(`http://localhost/api/wallet/breakdown${params}`) as never);
  return { status: res.status, body: await res.json() };
}

/** The `$match` the route built, so the test can assert on what it asked the database for. */
function matchStage() {
  return mockAggregate.mock.calls[0][0][0].$match;
}

describe("GET /api/wallet/breakdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalletRead.mockResolvedValue({ payload: { userId: "CUST-1", role: "customer" } });
    mockAggregate.mockResolvedValue([]);
  });

  it("asks for every outbound entry, with no category requirement", async () => {
    await call("?walletType=store");
    const $match = matchStage();

    // The clause that hid order payments. Its absence is the fix.
    expect($match.$or).toBeUndefined();
    expect($match.expenseCategory).toBeUndefined();
    expect($match.type.$in).toEqual(expect.arrayContaining(["DEBIT", "ADJUSTMENT"]));
  });

  it("groups an order payment under Orders & Purchases rather than dropping it", async () => {
    mockAggregate.mockResolvedValue([
      { _id: "__ORDER", total: 449300, count: 4 },
      { _id: "gst_registration", total: 300000, count: 2 },
    ]);

    const { body } = await call("?walletType=store");
    const orders = body.slices.find((s: { categoryKey: string }) => s.categoryKey === "__ORDER");

    expect(orders).toBeDefined();
    expect(orders.label).toBe("Orders & Purchases");
    expect(orders.total).toBe(4493);
  });

  it("reports a total equal to the sum of its slices", async () => {
    mockAggregate.mockResolvedValue([
      { _id: "__ORDER", total: 449300, count: 4 },
      { _id: "gst_registration", total: 300000, count: 2 },
      { _id: "__TRANSFER_OUT", total: 55300, count: 2 },
    ]);

    const { body } = await call("?walletType=store");
    const sum = body.slices.reduce((t: number, s: { total: number }) => t + s.total, 0);

    expect(body.totalSpent).toBeCloseTo(sum, 2);
    expect(body.totalSpent).toBeCloseTo(8046, 2);
  });

  describe("the All scope", () => {
    it("does not filter by wallet", async () => {
      await call("?walletType=all");
      expect(matchStage().walletType).toBeUndefined();
    });

    it("excludes transfers, because moving money between your own wallets is not spending it", async () => {
      await call("?walletType=all");
      // Counting the transfer here would double-count: whatever the Business Wallet then
      // spent is already in this same total.
      expect(matchStage().type.$in).not.toContain("TRANSFER_OUT");
    });

    it("keeps transfers in a single-wallet view, where the money genuinely left", async () => {
      await call("?walletType=store");
      expect(matchStage().type.$in).toContain("TRANSFER_OUT");
    });

    it("is the default when no wallet is named", async () => {
      const { body } = await call("");
      expect(body.walletType).toBe("all");
    });
  });

  it("still rejects a wallet type that does not exist", async () => {
    const { status } = await call("?walletType=nonsense");
    expect(status).toBe(400);
  });
});
