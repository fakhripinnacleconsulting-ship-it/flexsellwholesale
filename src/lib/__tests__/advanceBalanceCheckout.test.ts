import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hold / capture / release, and refund-on-cancel.
 *
 * These pin the properties that stop money being lost or duplicated at checkout: a capture
 * takes from `heldBalance` (not a second time from available), a release returns it, and a
 * repeated cancellation refunds exactly once.
 */

const advanceBalanceFindOneAndUpdate = vi.fn();
const advanceBalanceUpdateOne = vi.fn();
const txnFindOneAndUpdate = vi.fn();
const txnUpdateOne = vi.fn();
const txnCreate = vi.fn();

vi.mock("@/models/AdvanceBalance", () => ({
  default: {
    findOneAndUpdate: (...a: unknown[]) => advanceBalanceFindOneAndUpdate(...a),
    updateOne: (...a: unknown[]) => advanceBalanceUpdateOne(...a),
    findOne: () => ({ session: () => Promise.resolve({ _id: "wal_1", status: "active", availableBalance: 500000 }) }),
  },
}));

vi.mock("@/models/AdvanceBalanceTransaction", () => ({
  default: {
    findOneAndUpdate: (...a: unknown[]) => txnFindOneAndUpdate(...a),
    updateOne: (...a: unknown[]) => txnUpdateOne(...a),
    create: (...a: unknown[]) => txnCreate(...a),
  },
}));

vi.mock("../transactionHelper", () => ({
  runInTransaction: (cb: (s?: unknown) => Promise<unknown>) => cb(undefined),
}));

vi.mock("../advanceBalanceLedger", async () => {
  const actual = await vi.importActual<typeof import("../advanceBalanceLedger")>("../advanceBalanceLedger");
  return {
    ...actual,
    nextReceiptNumber: vi.fn(async (d: string) => (d === "credit" ? "WR-000001" : "WD-000001")),
    getOrCreateAdvanceBalance: vi.fn(async () => ({ _id: "wal_1", status: "active", availableBalance: 500000 })),
  };
});

import {
  reserveAdvanceBalanceFunds,
  captureAdvanceBalanceFunds,
  releaseAdvanceBalanceFunds,
  refundAdvanceBalanceOrder,
} from "../advanceBalanceCheckout";
import { InsufficientBalanceError } from "../advanceBalanceLedger";

const ACTOR = { role: "Customer" as const, name: "Sharma Traders", userId: "CUST-1" };

beforeEach(() => vi.clearAllMocks());

describe("reserveAdvanceBalanceFunds", () => {
  it("moves money from available into held, not out of the wallet", async () => {
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ _id: "wal_1", availableBalance: 200000 });
    txnCreate.mockResolvedValue([{ _id: "hold_1" }]);

    const result = await reserveAdvanceBalanceFunds({
      userId: "CUST-1",
      walletType: "store",
      amountPaise: 300000,
      actor: ACTOR,
      clientRequestId: "req-1",
      orderLabel: "Order FS-1",
    });

    expect(result.holdId).toBe("hold_1");

    const inc = advanceBalanceFindOneAndUpdate.mock.calls[0][1].$inc;
    expect(inc.availableBalance).toBe(-300000);
    expect(inc.heldBalance).toBe(300000);
    // Nothing is counted as spent yet — the order does not exist.
    expect(inc.totalDebited).toBeUndefined();
  });

  it("guards the reservation on a sufficient balance", async () => {
    advanceBalanceFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      reserveAdvanceBalanceFunds({
        userId: "CUST-1",
        walletType: "store",
        amountPaise: 900000,
        actor: ACTOR,
        clientRequestId: "req-1",
        orderLabel: "Order FS-1",
      })
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    const filter = advanceBalanceFindOneAndUpdate.mock.calls[0][0];
    // The condition is what makes two simultaneous checkouts resolve to one success.
    expect(filter.availableBalance).toEqual({ $gte: 900000 });
    expect(filter.status).toBe("active");
  });

  it("refuses a non-integer amount rather than storing a fractional paisa", async () => {
    await expect(
      reserveAdvanceBalanceFunds({
        userId: "CUST-1",
        walletType: "store",
        amountPaise: 1234.5,
        actor: ACTOR,
        clientRequestId: "req-1",
        orderLabel: "Order FS-1",
      })
    ).rejects.toThrow(/whole number/);
  });
});

describe("captureAdvanceBalanceFunds", () => {
  it("takes the money from held, never a second time from available", async () => {
    txnFindOneAndUpdate.mockResolvedValue({ _id: "hold_1", walletId: "wal_1", amount: 300000 });
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ availableBalance: 200000 });
    txnUpdateOne.mockResolvedValue({});

    const result = await captureAdvanceBalanceFunds({ holdId: "hold_1", orderId: "FS-1" });

    expect(result).toEqual({ transactionId: "hold_1", balancePaise: 200000 });

    const inc = advanceBalanceFindOneAndUpdate.mock.calls[0][1].$inc;
    expect(inc.heldBalance).toBe(-300000);
    expect(inc.totalDebited).toBe(300000);
    // The double-charge this test exists to prevent.
    expect(inc.availableBalance).toBeUndefined();
  });

  it("returns null when the hold was already released", async () => {
    txnFindOneAndUpdate.mockResolvedValue(null);

    const result = await captureAdvanceBalanceFunds({ holdId: "hold_1", orderId: "FS-1" });

    expect(result).toBeNull();
    expect(advanceBalanceFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("records balances that reconcile against the captured amount", async () => {
    txnFindOneAndUpdate.mockResolvedValue({ _id: "hold_1", walletId: "wal_1", amount: 300000 });
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ availableBalance: 200000 });
    txnUpdateOne.mockResolvedValue({});

    await captureAdvanceBalanceFunds({ holdId: "hold_1", orderId: "FS-1" });

    const set = txnUpdateOne.mock.calls[0][1].$set;
    expect(set.balanceBefore - set.balanceAfter).toBe(300000);
    expect(set.status).toBe("success");
  });
});

describe("releaseAdvanceBalanceFunds", () => {
  it("returns held money to the spendable balance", async () => {
    txnFindOneAndUpdate.mockResolvedValue({ _id: "hold_1", walletId: "wal_1", amount: 300000 });
    advanceBalanceUpdateOne.mockResolvedValue({});

    const released = await releaseAdvanceBalanceFunds("hold_1", "checkout_abandoned");

    expect(released).toBe(true);
    const inc = advanceBalanceUpdateOne.mock.calls[0][1].$inc;
    expect(inc.heldBalance).toBe(-300000);
    expect(inc.availableBalance).toBe(300000);
  });

  it("does nothing when the hold was already captured", async () => {
    // The condition { status: "pending" } is what makes a capture racing the sweeper
    // resolve to exactly one outcome — never both taken and returned.
    txnFindOneAndUpdate.mockResolvedValue(null);

    const released = await releaseAdvanceBalanceFunds("hold_1", "checkout_abandoned");

    expect(released).toBe(false);
    expect(advanceBalanceUpdateOne).not.toHaveBeenCalled();
  });
});

describe("refundAdvanceBalanceOrder", () => {
  it("credits the Advance Balance and writes a linked REFUND entry", async () => {
    txnFindOneAndUpdate.mockResolvedValue({
      _id: "txn_1",
      walletId: "wal_1",
      userId: "CUST-1",
      walletType: "store",
      amount: 300000,
    });
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ availableBalance: 500000 });
    txnCreate.mockResolvedValue([{ _id: "refund_1" }]);

    const result = await refundAdvanceBalanceOrder({
      walletTransactionId: "txn_1",
      orderId: "FS-1",
      actor: ACTOR,
      reason: "Order FS-1 cancelled",
    });

    expect(result).toEqual({ refunded: true, amountPaise: 300000 });

    const entry = txnCreate.mock.calls[0][0][0];
    expect(entry.type).toBe("REFUND");
    // Links back to the debit it undoes, so the pair is replayable from the ledger.
    expect(entry.reversalOf).toBe("txn_1");
    expect(entry.balanceAfter - entry.balanceBefore).toBe(300000);
  });

  it("refunds exactly once when a cancellation is repeated", async () => {
    // The second attempt finds the original already `reversed`, so the claim returns null.
    txnFindOneAndUpdate.mockResolvedValue(null);

    const result = await refundAdvanceBalanceOrder({
      walletTransactionId: "txn_1",
      orderId: "FS-1",
      actor: ACTOR,
      reason: "Order FS-1 cancelled",
    });

    expect(result).toEqual({ refunded: false });
    expect(advanceBalanceFindOneAndUpdate).not.toHaveBeenCalled();
    expect(txnCreate).not.toHaveBeenCalled();
  });

  it("only ever reverses a successful debit", async () => {
    txnFindOneAndUpdate.mockResolvedValue({
      _id: "txn_1",
      walletId: "wal_1",
      userId: "CUST-1",
      walletType: "store",
      amount: 300000,
    });
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ availableBalance: 500000 });
    txnCreate.mockResolvedValue([{ _id: "refund_1" }]);

    await refundAdvanceBalanceOrder({
      walletTransactionId: "txn_1",
      orderId: "FS-1",
      actor: ACTOR,
      reason: "cancelled",
    });

    const filter = txnFindOneAndUpdate.mock.calls[0][0];
    expect(filter.status).toBe("success");
    expect(filter.type).toBe("DEBIT");
  });

  it("refunds into the Advance Balance the money came from", async () => {
    // A Business-Wallet-funded order must not refund into the Store Advance Balance — that would
    // turn one-way money back into money spendable on goods.
    txnFindOneAndUpdate.mockResolvedValue({
      _id: "txn_1",
      walletId: "wal_business",
      userId: "CUST-1",
      walletType: "business",
      amount: 300000,
    });
    advanceBalanceFindOneAndUpdate.mockResolvedValue({ availableBalance: 500000 });
    txnCreate.mockResolvedValue([{ _id: "refund_1" }]);

    await refundAdvanceBalanceOrder({
      walletTransactionId: "txn_1",
      orderId: "FS-1",
      actor: ACTOR,
      reason: "cancelled",
    });

    const entry = txnCreate.mock.calls[0][0][0];
    expect(entry.walletId).toBe("wal_business");
    expect(entry.walletType).toBe("business");
  });
});
