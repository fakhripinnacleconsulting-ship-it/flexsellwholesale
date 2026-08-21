import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Advance Balance guard is the boundary that decides who may move a customer's money. With no
 * spend caps, no customer approval and no per-customer scoping, this permission check is
 * the only preventive control left — so its failure modes are worth pinning down.
 */

const getTokenFromCookie = vi.fn();
const verifyToken = vi.fn();
const managerFindById = vi.fn();
const customerFindById = vi.fn();
const customerUpdateOne = vi.fn();
const bcryptCompare = vi.fn();

vi.mock("../auth", () => ({
  getTokenFromCookie: (...a: unknown[]) => getTokenFromCookie(...a),
  verifyToken: (...a: unknown[]) => verifyToken(...a),
}));
vi.mock("../dbConnect", () => ({ default: vi.fn() }));
vi.mock("@/models/Manager", () => ({
  default: { findById: (...a: unknown[]) => managerFindById(...a) },
}));
vi.mock("@/models/Customer", () => ({
  default: {
    findById: (...a: unknown[]) => customerFindById(...a),
    updateOne: (...a: unknown[]) => customerUpdateOne(...a),
  },
}));
vi.mock("bcryptjs", () => ({
  default: { compare: (...a: unknown[]) => bcryptCompare(...a) },
}));

const chain = (value: unknown) => ({ select: () => ({ lean: () => Promise.resolve(value) }) });

import {
  requireAdvanceBalanceSpendAccess,
  requireAdvanceBalanceAdmin,
  requireAdvanceBalanceRead,
  verifyAdminPassword,
} from "../advanceBalanceGuard";

beforeEach(() => {
  vi.clearAllMocks();
  getTokenFromCookie.mockResolvedValue("token");
});

describe("requireAdvanceBalanceSpendAccess", () => {
  it("allows an admin without checking permissions", async () => {
    verifyToken.mockReturnValue({ userId: "A1", role: "admin" });

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeUndefined();
    expect(result.actor).toEqual({ role: "Admin", name: "Admin", userId: "A1" });
    expect(managerFindById).not.toHaveBeenCalled();
  });

  it("allows a manager holding the exact permission, and names them", async () => {
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });
    managerFindById.mockReturnValue(
      chain({ name: "Monika", status: "active", permissions: ["wallet_business"] })
    );

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeUndefined();
    // The name is what appears in the customer's passbook, so it must come from the
    // manager document and not from anything the request supplied.
    expect(result.actor).toEqual({ role: "Manager", name: "Monika", userId: "M1" });
  });

  it("refuses a manager holding only the OTHER wallet's permission", async () => {
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });
    managerFindById.mockReturnValue(
      chain({ name: "Monika", status: "active", permissions: ["wallet_store"] })
    );

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("does NOT honour the ops_shipping / orders fallback that order access allows", async () => {
    // verifyManagerOrderAccess ends with `if (hasPerm("ops_shipping") || hasPerm("orders"))`.
    // Inheriting that here would let a shipping manager spend a customer's balance.
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });
    managerFindById.mockReturnValue(
      chain({ name: "Monika", status: "active", permissions: ["ops_shipping", "orders"] })
    );

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("does not widen a root permission into Advance Balance access", async () => {
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });
    managerFindById.mockReturnValue(
      chain({ name: "Monika", status: "active", permissions: ["wallet"] })
    );

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeDefined();
  });

  it("refuses a suspended manager who still holds the permission", async () => {
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });
    managerFindById.mockReturnValue(
      chain({ name: "Monika", status: "suspended", permissions: ["wallet_business"] })
    );

    const result = await requireAdvanceBalanceSpendAccess("business");

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("refuses a customer outright", async () => {
    verifyToken.mockReturnValue({ userId: "C1", role: "customer" });

    const result = await requireAdvanceBalanceSpendAccess("store");

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("refuses when there is no session", async () => {
    getTokenFromCookie.mockResolvedValue(null);

    const result = await requireAdvanceBalanceSpendAccess("store");

    expect(result.error!.status).toBe(401);
  });
});

describe("requireAdvanceBalanceAdmin", () => {
  it("refuses a manager even with every Advance Balance permission", async () => {
    // Creating and returning money is not delegable at all — not by permission, not ever.
    verifyToken.mockReturnValue({ userId: "M1", role: "manager" });

    const result = await requireAdvanceBalanceAdmin();

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
    expect(managerFindById).not.toHaveBeenCalled();
  });

  it("allows an admin", async () => {
    verifyToken.mockReturnValue({ userId: "A1", role: "admin" });

    const result = await requireAdvanceBalanceAdmin();

    expect(result.error).toBeUndefined();
    expect(result.actor!.role).toBe("Admin");
  });
});

describe("requireAdvanceBalanceRead", () => {
  /**
   * The regression this suite exists for.
   *
   * A customer reading their own Advance Balance sends no `userId`. An earlier version compared
   * `payload.userId` against an empty string — never equal — so every customer got a 403 on
   * their own Advance Balance page and the whole feature was unreachable.
   */
  it("lets a customer read their own Advance Balance when no userId is given", async () => {
    verifyToken.mockReturnValue({ userId: "CUST-1", role: "customer" });

    for (const target of [undefined, null, ""]) {
      const result = await requireAdvanceBalanceRead(target as string | null | undefined);
      expect(result.error, `target ${JSON.stringify(target)} should be allowed`).toBeUndefined();
      expect(result.payload!.userId).toBe("CUST-1");
    }
  });

  it("lets a customer read their own Advance Balance when the id is passed explicitly", async () => {
    verifyToken.mockReturnValue({ userId: "CUST-1", role: "customer" });

    const result = await requireAdvanceBalanceRead("CUST-1");

    expect(result.error).toBeUndefined();
  });

  it("refuses a customer reading someone else's wallet", async () => {
    verifyToken.mockReturnValue({ userId: "CUST-1", role: "customer" });

    const result = await requireAdvanceBalanceRead("CUST-2");

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(403);
  });

  it("lets staff read any customer's wallet", async () => {
    for (const role of ["admin", "manager"]) {
      verifyToken.mockReturnValue({ userId: "S1", role });
      const result = await requireAdvanceBalanceRead("CUST-9");
      expect(result.error, `${role} should be allowed`).toBeUndefined();
    }
  });

  it("asks staff which Advance Balance they meant rather than guessing", async () => {
    // Staff hold no Advance Balance of their own, so an unqualified read is a mistake — and falling
    // through to `payload.userId` would query a Advance Balance that cannot exist.
    verifyToken.mockReturnValue({ userId: "S1", role: "admin" });

    const result = await requireAdvanceBalanceRead();

    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(400);
  });

  it("refuses when there is no session", async () => {
    getTokenFromCookie.mockResolvedValue(null);

    const result = await requireAdvanceBalanceRead();

    expect(result.error!.status).toBe(401);
  });
});

describe("verifyAdminPassword", () => {
  it("rejects a missing password without touching the database", async () => {
    const result = await verifyAdminPassword("A1", undefined);

    expect(result.ok).toBe(false);
    expect(customerFindById).not.toHaveBeenCalled();
  });

  it("accepts the correct password and clears any failure counter", async () => {
    customerFindById.mockReturnValue(chain({ password: "hash", failedLoginAttempts: 3 }));
    bcryptCompare.mockResolvedValue(true);

    const result = await verifyAdminPassword("A1", "correct");

    expect(result.ok).toBe(true);
    expect(customerUpdateOne).toHaveBeenCalledWith(
      { _id: "A1" },
      { $set: { failedLoginAttempts: 0, lockUntil: null } }
    );
  });

  it("counts a wrong password toward the same lockout the login route uses", async () => {
    customerFindById.mockReturnValue(chain({ password: "hash", failedLoginAttempts: 2 }));
    bcryptCompare.mockResolvedValue(false);

    const result = await verifyAdminPassword("A1", "wrong");

    expect(result.ok).toBe(false);
    expect(customerUpdateOne).toHaveBeenCalledWith({ _id: "A1" }, { $set: { failedLoginAttempts: 3 } });
  });

  it("locks the account after ten failures", async () => {
    customerFindById.mockReturnValue(chain({ password: "hash", failedLoginAttempts: 9 }));
    bcryptCompare.mockResolvedValue(false);

    await verifyAdminPassword("A1", "wrong");

    const update = customerUpdateOne.mock.calls[0][1].$set;
    expect(update.failedLoginAttempts).toBe(0);
    expect(update.lockUntil).toBeInstanceOf(Date);
  });

  it("refuses while locked, without consuming an attempt", async () => {
    customerFindById.mockReturnValue(
      chain({ password: "hash", lockUntil: new Date(Date.now() + 5 * 60 * 1000) })
    );

    const result = await verifyAdminPassword("A1", "anything");

    expect(result.ok).toBe(false);
    expect(bcryptCompare).not.toHaveBeenCalled();
  });
});
