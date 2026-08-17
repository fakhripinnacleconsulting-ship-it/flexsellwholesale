import { describe, it, expect } from "vitest";
import {
  isCreditType,
  isDuplicateKeyError,
  InsufficientBalanceError,
  WalletNotActiveError,
} from "../walletLedger";
import { WALLET_PERMISSIONS, MIN_RECHARGE_PAISE, MAX_RECHARGE_PAISE } from "../walletConstants";

describe("isCreditType", () => {
  it("treats every inbound movement as a credit", () => {
    expect(isCreditType("CREDIT")).toBe(true);
    expect(isCreditType("REFUND")).toBe(true);
    expect(isCreditType("TRANSFER_IN")).toBe(true);
  });

  it("treats every outbound movement as a debit", () => {
    expect(isCreditType("DEBIT")).toBe(false);
    expect(isCreditType("TRANSFER_OUT")).toBe(false);
  });

  it("treats ADJUSTMENT and REVERSAL as debits by default", () => {
    // Both can go either way in principle, but defaulting them to the *guarded* path
    // matters: a debit runs the conditional balance check, a credit does not. Defaulting
    // the ambiguous cases to credit would let a mis-typed correction overdraw a wallet.
    expect(isCreditType("ADJUSTMENT")).toBe(false);
    expect(isCreditType("REVERSAL")).toBe(false);
  });
});

describe("InsufficientBalanceError", () => {
  it("names the wallet the customer was actually short in", () => {
    expect(new InsufficientBalanceError("business").message).toBe(
      "Insufficient Business Wallet Balance"
    );
    expect(new InsufficientBalanceError("store").message).toBe(
      "Insufficient Store Wallet Balance"
    );
  });

  it("carries 409, not 500 — a short balance is an outcome, not a fault", () => {
    expect(new InsufficientBalanceError("store").status).toBe(409);
  });
});

describe("WalletNotActiveError", () => {
  it("says what state blocked the write", () => {
    expect(new WalletNotActiveError("frozen").message).toMatch(/frozen/);
    expect(new WalletNotActiveError("closed").message).toMatch(/closed/);
  });
});

describe("isDuplicateKeyError", () => {
  it("recognises a Mongo duplicate-key error", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
  });

  it("does not swallow other failures", () => {
    // A validation error must never be mistaken for "already processed" — that would
    // return success to a caller whose money never moved.
    expect(isDuplicateKeyError({ code: 121 })).toBe(false);
    expect(isDuplicateKeyError(new Error("network"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
    expect(isDuplicateKeyError(undefined)).toBe(false);
  });
});

describe("wallet permission mapping", () => {
  it("gives each wallet its own permission key", () => {
    expect(WALLET_PERMISSIONS.store).toBe("wallet_store");
    expect(WALLET_PERMISSIONS.business).toBe("wallet_business");
  });

  it("keeps the two keys distinct", () => {
    // A shared key would mean granting ad-campaign access also granted order money.
    expect(WALLET_PERMISSIONS.store).not.toBe(WALLET_PERMISSIONS.business);
  });

  it("uses keys with no colon, so no root-permission widening applies", () => {
    // requireAdminOrManagerAuth widens "orders:update" to "orders". A wallet key must not
    // be widenable to something a manager might already hold.
    expect(WALLET_PERMISSIONS.store).not.toContain(":");
    expect(WALLET_PERMISSIONS.business).not.toContain(":");
  });
});

describe("recharge bounds", () => {
  it("are stored as paise, not rupees", () => {
    expect(MIN_RECHARGE_PAISE).toBe(50000);
    expect(MAX_RECHARGE_PAISE).toBe(20000000);
  });

  it("leave a usable range", () => {
    expect(MAX_RECHARGE_PAISE).toBeGreaterThan(MIN_RECHARGE_PAISE);
  });
});
