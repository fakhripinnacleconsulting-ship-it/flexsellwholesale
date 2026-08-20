import { describe, it, expect } from "vitest";
import {
  isCreditType,
  isDuplicateKeyError,
  InsufficientBalanceError,
  AdvanceBalanceNotActiveError,
} from "../advanceBalanceLedger";
import { ADVANCE_BALANCE_PERMISSIONS, permissionsForAdvanceBalance, MIN_RECHARGE_PAISE, MAX_RECHARGE_PAISE } from "../advanceBalanceConstants";

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
  it("names the Advance Balance the customer was actually short in", () => {
    expect(new InsufficientBalanceError("business").message).toBe(
      "Business Advance Balance does not have enough funds"
    );
    expect(new InsufficientBalanceError("store").message).toBe(
      "Store Advance Balance does not have enough funds"
    );
  });

  it("carries 409, not 500 — a short balance is an outcome, not a fault", () => {
    expect(new InsufficientBalanceError("store").status).toBe(409);
  });
});

describe("AdvanceBalanceNotActiveError", () => {
  it("says what state blocked the write", () => {
    expect(new AdvanceBalanceNotActiveError("frozen").message).toMatch(/frozen/);
    expect(new AdvanceBalanceNotActiveError("closed").message).toMatch(/closed/);
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
  it("gives each Advance Balance its own permission key", () => {
    expect(ADVANCE_BALANCE_PERMISSIONS.store).toBe("advance_balance_store");
    expect(ADVANCE_BALANCE_PERMISSIONS.business).toBe("advance_balance_business");
  });

  /**
   * The rename's one genuinely dangerous edge.
   *
   * These ids are not just constants — they sit in every manager's `permissions` array in the
   * database. Accepting only the new id would revoke every existing manager's access the
   * moment it deployed, and a permission check does not fail loudly: it simply stops
   * matching. Both must resolve until the backfill has rewritten stored grants.
   */
  it("still accepts the legacy permission ids stored on existing managers", () => {
    expect(permissionsForAdvanceBalance("store")).toContain("wallet_store");
    expect(permissionsForAdvanceBalance("business")).toContain("wallet_business");
  });

  it("accepts the new ids too, so a backfilled manager keeps access", () => {
    expect(permissionsForAdvanceBalance("store")).toContain("advance_balance_store");
    expect(permissionsForAdvanceBalance("business")).toContain("advance_balance_business");
  });

  it("never lets one wallet's grant reach the other", () => {
    expect(permissionsForAdvanceBalance("store")).not.toContain("wallet_business");
    expect(permissionsForAdvanceBalance("store")).not.toContain("advance_balance_business");
    expect(permissionsForAdvanceBalance("business")).not.toContain("wallet_store");
    expect(permissionsForAdvanceBalance("business")).not.toContain("advance_balance_store");
  });

  it("keeps the two keys distinct", () => {
    // A shared key would mean granting ad-campaign access also granted order money.
    expect(ADVANCE_BALANCE_PERMISSIONS.store).not.toBe(ADVANCE_BALANCE_PERMISSIONS.business);
  });

  it("uses keys with no colon, so no root-permission widening applies", () => {
    // requireAdminOrManagerAuth widens "orders:update" to "orders". A Advance Balance key must not
    // be widenable to something a manager might already hold.
    expect(ADVANCE_BALANCE_PERMISSIONS.store).not.toContain(":");
    expect(ADVANCE_BALANCE_PERMISSIONS.business).not.toContain(":");
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
