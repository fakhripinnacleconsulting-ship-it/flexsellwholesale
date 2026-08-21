import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Reconciliation and hold release.
 *
 * Reconciliation is the only thing that can detect a ledger and a balance disagreeing — the
 * customer sees a number and has no way to know it is wrong — so its arithmetic is worth
 * pinning down precisely.
 */

const advanceBalanceFind = vi.fn();
const advanceBalanceUpdateOne = vi.fn();
const txnAggregate = vi.fn();
const txnFind = vi.fn();
const txnFindOneAndUpdate = vi.fn();

vi.mock("@/models/AdvanceBalance", () => ({
  default: {
    find: (...a: unknown[]) => advanceBalanceFind(...a),
    updateOne: (...a: unknown[]) => advanceBalanceUpdateOne(...a),
  },
}));

vi.mock("@/models/AdvanceBalanceTransaction", () => ({
  default: {
    aggregate: (...a: unknown[]) => txnAggregate(...a),
    find: (...a: unknown[]) => txnFind(...a),
    findOneAndUpdate: (...a: unknown[]) => txnFindOneAndUpdate(...a),
    updateOne: vi.fn(),
  },
}));

vi.mock("../advanceBalanceRecharge", () => ({ settleAdvanceBalanceTopUp: vi.fn() }));
vi.mock("razorpay", () => ({ default: class {} }));

const chain = (value: unknown) => ({
  select: () => ({ limit: () => ({ lean: () => Promise.resolve(value) }) }),
});
const sortedChain = (value: unknown) => ({
  select: () => ({ limit: () => ({ lean: () => Promise.resolve(value) }) }),
});

import { reconcileAdvanceBalances, releaseExpiredHolds } from "../advanceBalanceMaintenance";

beforeEach(() => vi.clearAllMocks());

describe("reconcileAdvanceBalances", () => {
  const advanceBalance = {
    _id: "wal_1",
    userId: "CUST-1",
    type: "business",
    availableBalance: 1500000,
    heldBalance: 0,
  };

  it("reports nothing when the ledger matches the balance", async () => {
    advanceBalanceFind.mockReturnValue(chain([advanceBalance]));
    txnAggregate.mockResolvedValue([{ _id: "wal_1", credits: 3500000, debits: 2000000 }]);

    const drift = await reconcileAdvanceBalances();

    expect(drift).toEqual([]);
  });

  it("counts held money as part of the recorded balance", async () => {
    // Held money has left `availableBalance` but has not been debited, so a Advance Balance with a
    // live checkout hold would otherwise look permanently short.
    advanceBalanceFind.mockReturnValue(chain([{ ...advanceBalance, availableBalance: 1200000, heldBalance: 300000 }]));
    txnAggregate.mockResolvedValue([{ _id: "wal_1", credits: 3500000, debits: 2000000 }]);

    const drift = await reconcileAdvanceBalances();

    expect(drift).toEqual([]);
  });

  it("reports a Advance Balance whose balance exceeds its ledger", async () => {
    advanceBalanceFind.mockReturnValue(chain([advanceBalance]));
    txnAggregate.mockResolvedValue([{ _id: "wal_1", credits: 3500000, debits: 2100000 }]);

    const drift = await reconcileAdvanceBalances();

    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({
      walletId: "wal_1",
      userId: "CUST-1",
      ledgerBalance: 1400000,
      recordedBalance: 1500000,
      // Positive means the customer holds more than the ledger accounts for.
      difference: 100000,
    });
  });

  it("reports a Advance Balance whose balance is short of its ledger", async () => {
    advanceBalanceFind.mockReturnValue(chain([advanceBalance]));
    txnAggregate.mockResolvedValue([{ _id: "wal_1", credits: 3500000, debits: 1900000 }]);

    const drift = await reconcileAdvanceBalances();

    expect(drift[0].difference).toBe(-100000);
  });

  it("treats a Advance Balance with no transactions as a zero ledger", async () => {
    advanceBalanceFind.mockReturnValue(chain([{ ...advanceBalance, availableBalance: 0 }]));
    txnAggregate.mockResolvedValue([]);

    const drift = await reconcileAdvanceBalances();

    expect(drift).toEqual([]);
  });

  it("flags a Advance Balance holding money with no ledger behind it at all", async () => {
    // The shape a bug would produce: balance written without a matching entry.
    advanceBalanceFind.mockReturnValue(chain([advanceBalance]));
    txnAggregate.mockResolvedValue([]);

    const drift = await reconcileAdvanceBalances();

    expect(drift).toHaveLength(1);
    expect(drift[0].ledgerBalance).toBe(0);
    expect(drift[0].recordedBalance).toBe(1500000);
  });

  it("does nothing when there are no wallets", async () => {
    advanceBalanceFind.mockReturnValue(chain([]));

    const drift = await reconcileAdvanceBalances();

    expect(drift).toEqual([]);
    expect(txnAggregate).not.toHaveBeenCalled();
  });
});

describe("releaseExpiredHolds", () => {
  it("returns each stale hold to the spendable balance", async () => {
    txnFind.mockReturnValue(sortedChain([{ _id: "hold_1", walletId: "wal_1", amount: 300000 }]));
    txnFindOneAndUpdate.mockResolvedValue({ _id: "hold_1" });
    advanceBalanceUpdateOne.mockResolvedValue({});

    const result = await releaseExpiredHolds();

    expect(result).toEqual({ released: 1, amount: 300000 });
    const inc = advanceBalanceUpdateOne.mock.calls[0][1].$inc;
    expect(inc.heldBalance).toBe(-300000);
    expect(inc.availableBalance).toBe(300000);
  });

  it("skips a hold that completed while the sweep was running", async () => {
    txnFind.mockReturnValue(sortedChain([{ _id: "hold_1", walletId: "wal_1", amount: 300000 }]));
    // The conditional claim loses: the checkout captured it first.
    txnFindOneAndUpdate.mockResolvedValue(null);

    const result = await releaseExpiredHolds();

    expect(result).toEqual({ released: 0, amount: 0 });
    // The money must not be returned for an order that was actually placed.
    expect(advanceBalanceUpdateOne).not.toHaveBeenCalled();
  });

  it("keeps going after one hold fails", async () => {
    txnFind.mockReturnValue(
      sortedChain([
        { _id: "hold_1", walletId: "wal_1", amount: 100000 },
        { _id: "hold_2", walletId: "wal_2", amount: 200000 },
      ])
    );
    txnFindOneAndUpdate.mockResolvedValue({ _id: "hold_x" });
    advanceBalanceUpdateOne.mockRejectedValueOnce(new Error("db blip")).mockResolvedValueOnce({});

    const result = await releaseExpiredHolds();

    // One bad row must not strand every customer behind it.
    expect(result.released).toBe(1);
  });
});
