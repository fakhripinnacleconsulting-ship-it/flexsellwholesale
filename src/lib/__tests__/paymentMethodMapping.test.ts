import { describe, it, expect, vi } from "vitest";

vi.mock("@/models/Invoice", () => ({ default: {} }));
vi.mock("@/models/Order", () => ({ default: {} }));
vi.mock("@/lib/idGeneratorServer", () => ({ generateNextId: vi.fn() }));

import { orderPaymentMethodFor, walletTypeForMethod, ORDER_PAYMENT_METHODS } from "@/lib/orderSettlement";
import { InsufficientBalanceError } from "@/lib/walletLedger";

/**
 * `Invoice.paymentMethod` is a free string; `Order.paymentMethod` is a closed enum.
 *
 * Copying the document's wording onto the order therefore fails validation outright, and it
 * did — creating an order paid from a Business Wallet died with
 *
 *     Order validation failed: paymentMethod: `Business Wallet` is not a valid enum value
 *
 * which surfaced to the user as a raw Mongoose string. The order stores `"Wallet"` and keeps
 * the wallet identity in `walletType`.
 */
describe("payment method mapping", () => {
  describe("wallets", () => {
    it.each([
      ["Store Wallet", "store"],
      ["Business Wallet", "business"],
    ] as const)("maps %s onto the order enum, keeping the wallet in walletType", (method, expectedType) => {
      expect(orderPaymentMethodFor(method)).toBe("Wallet");
      expect(walletTypeForMethod(method)).toBe(expectedType);
      // The thing that broke: the document's wording is not a valid order method.
      expect(ORDER_PAYMENT_METHODS).not.toContain(method);
    });

    it("keeps an explicit walletType even when the method is already 'Wallet'", () => {
      expect(orderPaymentMethodFor("Wallet", "business")).toBe("Wallet");
    });
  });

  describe("methods the order enum accepts", () => {
    it.each(["Cash", "COD", "UPI", "Bank Transfer", "Razorpay"])("passes %s through", (method) => {
      expect(orderPaymentMethodFor(method)).toBe(method);
      expect(walletTypeForMethod(method)).toBeUndefined();
    });
  });

  describe("methods it does not", () => {
    it.each(["NEFT/RTGS", "Cheque"])("returns undefined for %s rather than an invalid write", (method) => {
      // `findByIdAndUpdate` skips validators, so writing these would pass silently now and
      // break the next save(). Undefined lets the caller leave the field alone.
      expect(orderPaymentMethodFor(method)).toBeUndefined();
    });

    it("handles a missing method", () => {
      expect(orderPaymentMethodFor(undefined)).toBeUndefined();
    });
  });
});

/**
 * "Insufficient Business Wallet Balance" tells someone only that they must go and look it up.
 * Several routes claimed in their comments to "name the shortfall" while passing that bare
 * phrase straight through.
 */
describe("InsufficientBalanceError", () => {
  it("names the shortfall in money when the balances are known", () => {
    const err = new InsufficientBalanceError("business", {
      availablePaise: 250000, // ₹2,500
      requiredPaise: 480000, // ₹4,800
    });

    expect(err.shortfallAmount).toBe(2300);
    expect(err.availableAmount).toBe(2500);
    expect(err.requiredAmount).toBe(4800);
    expect(err.message).toContain("Business Wallet");
    expect(err.message).toContain("2,300");
  });

  it("never reports a negative shortfall if the balance moved", () => {
    const err = new InsufficientBalanceError("store", { availablePaise: 500000, requiredPaise: 100000 });
    expect(err.shortfallAmount).toBe(0);
  });

  it("falls back to the plain phrasing when no balances are supplied", () => {
    const err = new InsufficientBalanceError("store");
    expect(err.message).toBe("Insufficient Store Wallet Balance");
    expect(err.shortfallAmount).toBeUndefined();
  });

  it("stays a 409 either way", () => {
    expect(new InsufficientBalanceError("store").status).toBe(409);
    expect(
      new InsufficientBalanceError("store", { availablePaise: 0, requiredPaise: 100 }).status
    ).toBe(409);
  });
});
