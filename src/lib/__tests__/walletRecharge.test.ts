import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * These exercise the settlement decision logic — the branches that decide whether money is
 * credited — with the database mocked. The concurrency guarantees they describe come from
 * MongoDB's atomic findOneAndUpdate, which is verified separately in the integration pass.
 */

const findOne = vi.fn();
const findOneAndUpdate = vi.fn();
const updateOne = vi.fn();
const walletFindOneAndUpdate = vi.fn();

vi.mock("@/models/WalletTransaction", () => ({
  default: {
    findOne: (...args: unknown[]) => findOne(...args),
    findOneAndUpdate: (...args: unknown[]) => findOneAndUpdate(...args),
    updateOne: (...args: unknown[]) => updateOne(...args),
  },
}));

vi.mock("@/models/Wallet", () => ({
  default: {
    findOneAndUpdate: (...args: unknown[]) => walletFindOneAndUpdate(...args),
  },
}));

vi.mock("../transactionHelper", () => ({
  runInTransaction: (cb: (s?: unknown) => Promise<unknown>) => cb(undefined),
}));

vi.mock("../walletLedger", () => ({
  nextReceiptNumber: vi.fn(async () => "WR-000042"),
  getOrCreateWallet: vi.fn(),
}));

const lean = (value: unknown) => ({ lean: () => Promise.resolve(value) });

import { settleWalletRecharge } from "../walletRecharge";

const PENDING = {
  _id: "txn_1",
  userId: "CUST-1",
  walletId: "wal_1",
  walletType: "business" as const,
  amount: 3000000, // ₹30,000
  status: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settleWalletRecharge", () => {
  it("credits the wallet when the captured amount matches", async () => {
    findOne.mockReturnValue(lean(PENDING));
    findOneAndUpdate.mockResolvedValue({ _id: "txn_1" });
    walletFindOneAndUpdate.mockResolvedValue({ availableBalance: 3000000 });
    updateOne.mockResolvedValue({});

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "webhook",
    });

    expect(result).toEqual({
      status: "credited",
      transactionId: "txn_1",
      balancePaise: 3000000,
    });
    expect(walletFindOneAndUpdate).toHaveBeenCalledOnce();
  });

  it("returns already_settled without crediting when the row is already success", async () => {
    findOne.mockReturnValue(lean({ ...PENDING, status: "success" }));

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "webhook",
    });

    expect(result.status).toBe("already_settled");
    // The whole point: a replayed webhook must not touch the balance.
    expect(walletFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("credits exactly once when the conditional claim loses a race", async () => {
    // Two callers see status "pending"; only one wins findOneAndUpdate. The loser gets null.
    findOne.mockReturnValue(lean(PENDING));
    findOneAndUpdate.mockResolvedValue(null);

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "callback",
    });

    expect(result.status).toBe("already_settled");
    expect(walletFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("refuses to credit when Razorpay captured a different amount", async () => {
    findOne.mockReturnValue(lean(PENDING));

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 100, // ₹1 against a ₹30,000 intent
      source: "webhook",
    });

    expect(result).toEqual({
      status: "amount_mismatch",
      expectedPaise: 3000000,
      receivedPaise: 100,
    });
    expect(walletFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("credits the stored amount, never a larger captured one", async () => {
    // The exploitable direction is crediting more than was intended, so a larger capture
    // is a mismatch too — not a bonus.
    findOne.mockReturnValue(lean(PENDING));

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 9000000,
      source: "webhook",
    });

    expect(result.status).toBe("amount_mismatch");
    expect(walletFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("reports not_found for a payment with no matching intent", async () => {
    findOne.mockReturnValue(lean(null));

    const result = await settleWalletRecharge({
      razorpayOrderId: "order_unknown",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "webhook",
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("throws rather than swallowing the payment when the wallet is frozen", async () => {
    findOne.mockReturnValue(lean(PENDING));
    findOneAndUpdate.mockResolvedValue({ _id: "txn_1" });
    // The conditional { status: "active" } does not match a frozen wallet.
    walletFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      settleWalletRecharge({
        razorpayOrderId: "order_x",
        razorpayPaymentId: "pay_x",
        capturedPaise: 3000000,
        source: "webhook",
      })
    ).rejects.toThrow(/not active/);
  });

  it("records which path settled it, for later reconciliation", async () => {
    findOne.mockReturnValue(lean(PENDING));
    findOneAndUpdate.mockResolvedValue({ _id: "txn_1" });
    walletFindOneAndUpdate.mockResolvedValue({ availableBalance: 3000000 });
    updateOne.mockResolvedValue({});

    await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "sweeper",
    });

    const claim = findOneAndUpdate.mock.calls[0];
    expect(claim[0]).toEqual({ _id: "txn_1", status: "pending" });
    expect(claim[1].$set["metadata.settledVia"]).toBe("sweeper");
    expect(claim[1].$set.paymentId).toBe("pay_x");
  });

  it("writes balanceBefore and balanceAfter that reconcile against the amount", async () => {
    findOne.mockReturnValue(lean(PENDING));
    findOneAndUpdate.mockResolvedValue({ _id: "txn_1" });
    walletFindOneAndUpdate.mockResolvedValue({ availableBalance: 4500000 });
    updateOne.mockResolvedValue({});

    await settleWalletRecharge({
      razorpayOrderId: "order_x",
      razorpayPaymentId: "pay_x",
      capturedPaise: 3000000,
      source: "webhook",
    });

    const set = updateOne.mock.calls[0][1].$set;
    expect(set.balanceAfter - set.balanceBefore).toBe(PENDING.amount);
    expect(set.balanceAfter).toBe(4500000);
    expect(set.status).toBe("success");
    expect(set.receiptNumber).toBe("WR-000042");
  });
});
